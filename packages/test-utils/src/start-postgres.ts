import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../../..');

export interface StartedPostgres {
  url: string;
  stop(): Promise<void>;
}

export async function startPostgres(): Promise<StartedPostgres> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:16-alpine',
  )
    .withDatabase('lambder_test')
    .withUsername('lambder')
    .withPassword('lambder')
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  // The pg Pool is memoized on globalThis to survive Lambda warm starts.
  // Clear it here so a new container gets a fresh pool.
  // biome-ignore lint/suspicious/noExplicitAny: globalThis access
  delete (globalThis as any)._pgPool;

  // Apply Drizzle migrations against the freshly started container.
  execSync('pnpm --filter @lambder/db exec tsx scripts/run-migrations.ts', {
    cwd: REPO_ROOT,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });

  return {
    url,
    async stop() {
      // biome-ignore lint/suspicious/noExplicitAny: globalThis access
      const pool = (globalThis as any)._pgPool;
      if (pool) {
        try {
          await pool.end();
        } catch {
          /* already closed */
        }
        // biome-ignore lint/suspicious/noExplicitAny: globalThis access
        delete (globalThis as any)._pgPool;
      }
      await container.stop();
    },
  };
}
