import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getDb, getPool } from '../src/pool.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const db = getDb(url);
await migrate(db, { migrationsFolder: './migrations' });
await getPool(url).end();
console.log('Migrations applied');
