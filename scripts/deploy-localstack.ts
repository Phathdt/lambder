// Deploy auth-api + products-api to LocalStack as Lambda functions behind a
// single REST API Gateway (v1). The gateway routes path prefixes to the
// matching Lambda — exactly like AWS API Gateway in production.
//
// Routes:
//   /auth/{proxy+}      → lambder-auth-api Lambda
//   /products/{proxy+}  → lambder-products-api Lambda
//
// Output: a single base URL the frontend can talk to.
//
// Pre-reqs: docker compose up -d, pnpm build, .env populated.

import 'dotenv/config';
import {
  APIGatewayClient,
  CreateDeploymentCommand,
  CreateResourceCommand,
  CreateRestApiCommand,
  DeleteRestApiCommand,
  GetResourcesCommand,
  GetRestApisCommand,
  PutIntegrationCommand,
  PutMethodCommand,
} from '@aws-sdk/client-api-gateway';
import { CreateRoleCommand, GetRoleCommand, IAMClient } from '@aws-sdk/client-iam';
import {
  AddPermissionCommand,
  CreateEventSourceMappingCommand,
  CreateFunctionCommand,
  DeleteEventSourceMappingCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
  ListEventSourceMappingsCommand,
} from '@aws-sdk/client-lambda';
import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  PurgeQueueCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import AdmZip from 'adm-zip';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
const ACCOUNT_ID = '000000000000';

const lambda = new LambdaClient({ endpoint: ENDPOINT, region: REGION });
const iam = new IAMClient({ endpoint: ENDPOINT, region: REGION });
const apigw = new APIGatewayClient({ endpoint: ENDPOINT, region: REGION });
const sqs = new SQSClient({ endpoint: ENDPOINT, region: REGION });

const ROLE_NAME = 'lambder-lambda-role';
const REST_API_NAME = 'lambder-gateway';
const STAGE_NAME = 'local';

interface AppSpec {
  name: string;
  fnName: string;
  pathPrefix?: string; // omit for non-HTTP apps (SQS-triggered worker)
  triggeredBy?: 'sqs'; // when set, attach an event source mapping
}

const APPS: AppSpec[] = [
  { name: 'auth-api', fnName: 'lambder-auth-api', pathPrefix: 'auth' },
  { name: 'products-api', fnName: 'lambder-products-api', pathPrefix: 'products' },
  { name: 'email-worker', fnName: 'lambder-email-worker', triggeredBy: 'sqs' },
];

const EMAIL_QUEUE_NAME = 'lambder-emails-local';
const EMAIL_DLQ_NAME = 'lambder-emails-dlq-local';

// --- IAM role ---------------------------------------------------------------

async function ensureRole(): Promise<string> {
  try {
    const { Role } = await iam.send(new GetRoleCommand({ RoleName: ROLE_NAME }));
    return Role!.Arn!;
  } catch {
    const trust = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: { Service: 'lambda.amazonaws.com' },
          Action: 'sts:AssumeRole',
        },
      ],
    };
    const { Role } = await iam.send(
      new CreateRoleCommand({
        RoleName: ROLE_NAME,
        AssumeRolePolicyDocument: JSON.stringify(trust),
      }),
    );
    return Role!.Arn!;
  }
}

// --- SQS queues + event source mappings ------------------------------------

interface QueueInfo {
  url: string;
  arn: string;
  // URL Lambdas inside docker reach the queue at; used in env vars.
  internalUrl: string;
}

async function ensureQueues(): Promise<{ main: QueueInfo; dlq: QueueInfo }> {
  // 1) DLQ first — main queue's RedrivePolicy needs the DLQ ARN.
  await sqs.send(new CreateQueueCommand({ QueueName: EMAIL_DLQ_NAME })).catch(() => undefined);
  const dlqUrl = (await sqs.send(new GetQueueUrlCommand({ QueueName: EMAIL_DLQ_NAME }))).QueueUrl!;
  const dlqArn = (
    await sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: dlqUrl, AttributeNames: ['QueueArn'] }),
    )
  ).Attributes!.QueueArn!;

  // 2) Main queue with redrive policy. CreateQueue is idempotent if attrs match.
  const redrivePolicy = JSON.stringify({
    deadLetterTargetArn: dlqArn,
    maxReceiveCount: '3',
  });
  await sqs
    .send(
      new CreateQueueCommand({
        QueueName: EMAIL_QUEUE_NAME,
        Attributes: {
          VisibilityTimeout: '30',
          RedrivePolicy: redrivePolicy,
        },
      }),
    )
    .catch(() => undefined);
  const mainUrl = (await sqs.send(new GetQueueUrlCommand({ QueueName: EMAIL_QUEUE_NAME })))
    .QueueUrl!;
  const mainArn = (
    await sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: mainUrl, AttributeNames: ['QueueArn'] }),
    )
  ).Attributes!.QueueArn!;

  // Purge stale messages from previous deploys so DLQ isn't polluted with
  // payloads pointing at deleted users.
  await sqs.send(new PurgeQueueCommand({ QueueUrl: mainUrl })).catch(() => undefined);

  // Inside the LocalStack docker network, Lambdas reach SQS via the
  // localstack hostname rather than localhost.
  const toInternal = (u: string) => u.replace('http://localhost:4566', 'http://localstack:4566');
  console.log(`[sqs] main queue ${mainUrl}`);
  console.log(`[sqs] dlq        ${dlqUrl}`);
  return {
    main: { url: mainUrl, arn: mainArn, internalUrl: toInternal(mainUrl) },
    dlq: { url: dlqUrl, arn: dlqArn, internalUrl: toInternal(dlqUrl) },
  };
}

async function ensureEventSourceMapping(fnName: string, queueArn: string) {
  const existing = await lambda.send(
    new ListEventSourceMappingsCommand({ FunctionName: fnName, EventSourceArn: queueArn }),
  );
  for (const esm of existing.EventSourceMappings ?? []) {
    if (esm.UUID) {
      await lambda
        .send(new DeleteEventSourceMappingCommand({ UUID: esm.UUID }))
        .catch(() => undefined);
    }
  }
  await lambda.send(
    new CreateEventSourceMappingCommand({
      FunctionName: fnName,
      EventSourceArn: queueArn,
      BatchSize: 5,
      MaximumBatchingWindowInSeconds: 2,
    }),
  );
  console.log(`[sqs] event source mapping ${fnName} ← ${queueArn}`);
}

// --- Lambda packaging -------------------------------------------------------

const addDirToZip = (zip: AdmZip, root: string, dir: string) => {
  for (const entry of readdirSync(dir)) {
    if (entry === '.bin') continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) addDirToZip(zip, root, full);
    else {
      const rel = relative(root, full).split('\\').join('/');
      const zipPath = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      zip.addLocalFile(full, zipPath);
    }
  }
};

const prepareDeployDir = (appName: string): string => {
  const target = resolve(process.cwd(), '.deploy', appName);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  console.log(`[pack] pnpm deploy ${appName} -> ${target}`);
  execSync(
    [
      'pnpm deploy',
      `--filter ${appName}`,
      '--prod',
      '--config.node-linker=hoisted',
      '--config.supported-architectures.os=linux',
      '--config.supported-architectures.cpu=arm64',
      '--config.supported-architectures.libc=glibc',
      target,
    ].join(' '),
    { stdio: 'inherit' },
  );
  return target;
};

const buildZip = (deployDir: string, appName: string): Buffer => {
  const zip = new AdmZip();
  zip.addFile('package.json', Buffer.from(JSON.stringify({ type: 'module' })));
  const bundlePath = resolve(process.cwd(), 'dist/apps', appName, 'main.js');
  const sourcemap = `${bundlePath}.map`;
  zip.addLocalFile(bundlePath);
  if (existsSync(sourcemap)) zip.addLocalFile(sourcemap);
  const nm = resolve(deployDir, 'node_modules');
  if (existsSync(nm)) addDirToZip(zip, deployDir, nm);
  return zip.toBuffer();
};

function envForApp(spec: AppSpec, queues?: { mainUrl: string }): Record<string, string> {
  const base: Record<string, string> = {
    NODE_OPTIONS: '--enable-source-maps',
    NODE_ENV: 'production',
    AWS_ENDPOINT_URL: 'http://localstack:4566',
    AWS_REGION: REGION,
    // OTel collector reachable from Lambda containers via host gateway.
    OTEL_EXPORTER_OTLP_ENDPOINT:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://host.docker.internal:4318',
    OTEL_SERVICE_NAME: spec.fnName,
  };
  if (spec.name === 'email-worker') {
    return {
      ...base,
      LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
    };
  }
  // Auth + products share the full env. Inject EMAIL_QUEUE_URL only into auth.
  const httpEnv: Record<string, string> = {
    ...base,
    DATABASE_URL: process.env.DATABASE_URL!.replace('localhost', 'host.docker.internal'),
    REDIS_URL: process.env.REDIS_URL!.replace('localhost', 'host.docker.internal'),
    JWT_PRIVATE_KEY_PEM: process.env.JWT_PRIVATE_KEY_PEM!,
    JWT_PUBLIC_KEY_PEM: process.env.JWT_PUBLIC_KEY_PEM!,
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '900',
    JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '604800',
    JWT_ISSUER: 'lambder',
    JWT_AUDIENCE: 'lambder.api',
    CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:5173',
  };
  if (spec.name === 'auth-api' && queues) httpEnv.EMAIL_QUEUE_URL = queues.mainUrl;
  return httpEnv;
}

async function deployLambda(
  spec: AppSpec,
  roleArn: string,
  queues?: { mainUrl: string },
): Promise<string> {
  const Environment = { Variables: envForApp(spec, queues) };

  try {
    await lambda.send(new DeleteFunctionCommand({ FunctionName: spec.fnName }));
  } catch {
    /* didn't exist */
  }

  const zipBuf = buildZip(prepareDeployDir(spec.name), spec.name);
  console.log(`[pack] ${spec.fnName} zip = ${(zipBuf.length / 1024 / 1024).toFixed(2)} MB`);

  await lambda.send(
    new CreateFunctionCommand({
      FunctionName: spec.fnName,
      Runtime: 'nodejs20.x',
      Role: roleArn,
      Handler: 'main.handler',
      Code: { ZipFile: zipBuf },
      Timeout: 10,
      MemorySize: 512,
      Environment,
      Architectures: ['arm64'],
    }),
  );
  const { Configuration } = await lambda.send(
    new GetFunctionCommand({ FunctionName: spec.fnName }),
  );
  console.log(`[lambda] created ${spec.fnName}`);
  return Configuration!.FunctionArn!;
}

// --- API Gateway v1 (REST API) ---------------------------------------------

async function ensureFreshRestApi(): Promise<{ apiId: string; rootResourceId: string }> {
  // Wipe any previous gateway with the same name to keep deploys idempotent.
  const existing = await apigw.send(new GetRestApisCommand({}));
  for (const api of existing.items ?? []) {
    if (api.name === REST_API_NAME && api.id) {
      await apigw.send(new DeleteRestApiCommand({ restApiId: api.id }));
    }
  }
  const created = await apigw.send(
    new CreateRestApiCommand({
      name: REST_API_NAME,
      endpointConfiguration: { types: ['REGIONAL'] },
    }),
  );
  const apiId = created.id!;
  const resources = await apigw.send(new GetResourcesCommand({ restApiId: apiId }));
  const root = resources.items!.find((r) => r.path === '/');
  return { apiId, rootResourceId: root!.id! };
}

async function wireMethod(
  apiId: string,
  resourceId: string,
  fnArn: string,
  fnName: string,
): Promise<void> {
  await apigw.send(
    new PutMethodCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'ANY',
      authorizationType: 'NONE',
      requestParameters: { 'method.request.path.proxy': true },
    }),
  );
  await apigw.send(
    new PutIntegrationCommand({
      restApiId: apiId,
      resourceId,
      httpMethod: 'ANY',
      type: 'AWS_PROXY',
      integrationHttpMethod: 'POST',
      uri: `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${fnArn}/invocations`,
    }),
  );
  // Allow API Gateway to invoke the Lambda.
  await lambda
    .send(
      new AddPermissionCommand({
        FunctionName: fnName,
        StatementId: `apigw-invoke-${resourceId}`,
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: `arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${apiId}/*/*`,
      }),
    )
    .catch(() => {
      /* permission may already exist */
    });
}

// Some Lambda routes (auth /signup, /login, /refresh) live at the prefix root
// (no further path segment). API Gateway's {proxy+} only matches one or more
// segments, so we also wire ANY on the /<prefix> resource itself.
async function wireRootAndProxy(
  apiId: string,
  parentId: string,
  pathPart: string,
  fnArn: string,
  fnName: string,
): Promise<void> {
  const base = await apigw.send(
    new CreateResourceCommand({ restApiId: apiId, parentId, pathPart }),
  );
  // ANY on /<pathPart>
  await wireMethod(apiId, base.id!, fnArn, fnName);

  const proxy = await apigw.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: base.id!,
      pathPart: '{proxy+}',
    }),
  );
  // ANY on /<pathPart>/{proxy+}
  await wireMethod(apiId, proxy.id!, fnArn, fnName);
}

// --- Main -------------------------------------------------------------------

async function main() {
  const roleArn = await ensureRole();
  console.log('[iam] role:', roleArn);

  // Provision SQS first so auth-api Lambda env can include the queue URL.
  const queues = await ensureQueues();

  const lambdaArns: Record<string, string> = {};
  for (const app of APPS) {
    lambdaArns[app.name] = await deployLambda(app, roleArn, { mainUrl: queues.main.internalUrl });
  }

  // Wire SQS event source mapping for any worker apps (no API GW for these).
  for (const app of APPS) {
    if (app.triggeredBy === 'sqs') {
      await ensureEventSourceMapping(app.fnName, queues.main.arn);
    }
  }

  console.log('[apigw] creating REST API');
  const { apiId, rootResourceId } = await ensureFreshRestApi();

  for (const app of APPS) {
    if (!app.pathPrefix) continue; // skip workers
    await wireRootAndProxy(
      apiId,
      rootResourceId,
      app.pathPrefix,
      lambdaArns[app.name]!,
      app.fnName,
    );
    console.log(`[apigw] wired /${app.pathPrefix}/* → ${app.fnName}`);
  }

  await apigw.send(new CreateDeploymentCommand({ restApiId: apiId, stageName: STAGE_NAME }));
  const baseUrl = `${ENDPOINT}/restapis/${apiId}/${STAGE_NAME}/_user_request_`;

  const webEnv = resolve(process.cwd(), 'apps/web/.env.local');
  writeFileSync(webEnv, `VITE_API_BASE_URL=${baseUrl}\n`);

  // Surface queue URL for `awslocal sqs receive-message` debugging.
  const workerEnv = resolve(process.cwd(), 'apps/email-worker/.env.local');
  writeFileSync(workerEnv, `EMAIL_QUEUE_URL=${queues.main.url}\n`);

  console.log('\n✓ Deploy complete');
  console.log(`   gateway:  ${baseUrl}`);
  console.log(`   queue:    ${queues.main.url}`);
  console.log(`   dlq:      ${queues.dlq.url}`);
  console.log(`   wrote     ${webEnv}`);
  console.log(`   wrote     ${workerEnv}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
