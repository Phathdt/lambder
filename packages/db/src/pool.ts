import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: pg.Pool | undefined;
}

// Untyped schema — feature packages own their own table definitions and pass
// them locally to drizzle queries. This keeps @lambder/db decoupled from
// @lambder/auth and @lambder/products (no circular deps).
export type Database = NodePgDatabase;

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

export const getDb = (databaseUrl: string): Database => drizzle(getPool(databaseUrl));
