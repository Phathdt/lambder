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
  CreateFunctionCommand,
  DeleteFunctionCommand,
  GetFunctionCommand,
  LambdaClient,
} from '@aws-sdk/client-lambda';
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

const ROLE_NAME = 'lambder-lambda-role';
const REST_API_NAME = 'lambder-gateway';
const STAGE_NAME = 'local';

interface AppSpec {
  name: string;
  fnName: string;
  pathPrefix: string;
}

const APPS: AppSpec[] = [
  { name: 'auth-api', fnName: 'lambder-auth-api', pathPrefix: 'auth' },
  { name: 'products-api', fnName: 'lambder-products-api', pathPrefix: 'products' },
];

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

async function deployLambda(spec: AppSpec, roleArn: string): Promise<string> {
  const Environment = {
    Variables: {
      DATABASE_URL: process.env.DATABASE_URL!.replace('localhost', 'host.docker.internal'),
      REDIS_URL: process.env.REDIS_URL!.replace('localhost', 'host.docker.internal'),
      JWT_PRIVATE_KEY_PEM: process.env.JWT_PRIVATE_KEY_PEM!,
      JWT_PUBLIC_KEY_PEM: process.env.JWT_PUBLIC_KEY_PEM!,
      JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '900',
      JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '604800',
      JWT_ISSUER: 'lambder',
      JWT_AUDIENCE: 'lambder.api',
      CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost:3000',
      NODE_OPTIONS: '--enable-source-maps',
    },
  };

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

async function createProxyResource(
  apiId: string,
  parentId: string,
  pathPart: string,
): Promise<string> {
  // Create /<pathPart>
  const base = await apigw.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId,
      pathPart,
    }),
  );
  // Create /<pathPart>/{proxy+}
  const proxy = await apigw.send(
    new CreateResourceCommand({
      restApiId: apiId,
      parentId: base.id!,
      pathPart: '{proxy+}',
    }),
  );
  return proxy.id!;
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

  const lambdaArns: Record<string, string> = {};
  for (const app of APPS) lambdaArns[app.name] = await deployLambda(app, roleArn);

  console.log('[apigw] creating REST API');
  const { apiId, rootResourceId } = await ensureFreshRestApi();

  for (const app of APPS) {
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

  // Drop the URL into apps/web/.env.local for the frontend to pick up.
  const webEnv = resolve(process.cwd(), 'apps/web/.env.local');
  writeFileSync(webEnv, `VITE_API_BASE_URL=${baseUrl}\n`);

  console.log('\n✓ Deploy complete');
  console.log(`   gateway: ${baseUrl}`);
  console.log(`   wrote ${webEnv}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
