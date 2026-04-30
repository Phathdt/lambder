import { config } from 'dotenv';
import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool } from '../src/pool';

// Load env from monorepo root .env when invoked via pnpm filter.
config({ path: resolve(process.cwd(), '../../.env') });
config();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

async function main() {
  const db = getDb(url!);
  await migrate(db, { migrationsFolder: './migrations' });
  await getPool(url!).end();
  console.log('Migrations applied');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
