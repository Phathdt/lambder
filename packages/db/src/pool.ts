import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: pg.Pool | undefined;
}

export type Database = NodePgDatabase<typeof schema>;

export const getPool = (databaseUrl: string): pg.Pool => {
  if (!globalThis._pgPool) {
    globalThis._pgPool = new pg.Pool({
      connectionString: databaseUrl,
      max: 1,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }
  return globalThis._pgPool;
};

export const getDb = (databaseUrl: string): Database =>
  drizzle(getPool(databaseUrl), { schema });
