// Deploy auth-api + products-api to LocalStack as Lambda functions with
// Function URLs. Uses pnpm deploy to produce flat node_modules per app, then
// zips dist + node_modules into the Lambda artifact.
//
// Pre-reqs: docker compose up -d, pnpm build, .env populated.

import 'dotenv/config';
import { CreateRoleCommand, GetRoleCommand, IAMClient } from '@aws-sdk/client-iam';
import {
  CreateFunctionCommand,
  CreateFunctionUrlConfigCommand,
  DeleteFunctionCommand,
  GetFunctionUrlConfigCommand,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import AdmZip from 'adm-zip';
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';

const lambda = new LambdaClient({ endpoint: ENDPOINT, region: REGION });
const iam = new IAMClient({ endpoint: ENDPOINT, region: REGION });

const ROLE_NAME = 'lambder-lambda-role';

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

interface AppSpec {
  name: string;
  fnName: string;
}

// Recursively add a directory to a zip while preserving relative paths.
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
  // hoisted node-linker → flat node_modules without .pnpm/ symlinks (smaller zip).
  // Install native binaries for the Lambda target (Linux arm64) regardless of
  // the host arch by passing supported-architectures via env-style config.
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
  // Mark as ESM (rolldown emits ESM into main.js).
  zip.addFile('package.json', Buffer.from(JSON.stringify({ type: 'module' })));
  const bundlePath = resolve(process.cwd(), 'dist/apps', appName, 'main.js');
  const sourcemap = `${bundlePath}.map`;
  zip.addLocalFile(bundlePath);
  if (existsSync(sourcemap)) zip.addLocalFile(sourcemap);
  const nm = resolve(deployDir, 'node_modules');
  if (existsSync(nm)) addDirToZip(zip, deployDir, nm);
  return zip.toBuffer();
};

async function deployFunction(spec: AppSpec, roleArn: string): Promise<string> {
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
  console.log(`[lambda] created ${spec.fnName}`);

  let url: string;
  try {
    const cfg = await lambda.send(
      new GetFunctionUrlConfigCommand({ FunctionName: spec.fnName }),
    );
    url = cfg.FunctionUrl!;
  } catch {
    const cfg = await lambda.send(
      new CreateFunctionUrlConfigCommand({
        FunctionName: spec.fnName,
        AuthType: 'NONE',
        InvokeMode: 'BUFFERED',
      }),
    );
    url = cfg.FunctionUrl!;
  }
  return url;
}

async function main() {
  const roleArn = await ensureRole();
  console.log('[iam] role:', roleArn);

  const apps: AppSpec[] = [
    { name: 'auth-api', fnName: 'lambder-auth-api' },
    { name: 'products-api', fnName: 'lambder-products-api' },
  ];

  const urls: { name: string; url: string }[] = [];
  for (const app of apps) {
    const url = await deployFunction(app, roleArn);
    const localUrl = url.replace(/^https:\/\/[^/]+/, ENDPOINT);
    urls.push({ name: app.name, url: localUrl });
  }

  console.log('\n✓ Deploy complete');
  for (const { name, url } of urls) console.log(`   ${name}: ${url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
