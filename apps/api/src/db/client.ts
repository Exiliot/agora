import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config.js';
import * as schema from './schema.js';

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.PG_POOL_MAX,
  // Fail fast on a statement stuck behind a lock instead of tying up a pool
  // connection indefinitely — protects the whole app from one runaway query.
  statement_timeout: 10_000,
  idleTimeoutMillis: 30_000,
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;

export const pingDb = async (): Promise<boolean> => {
  const result = await pool.query<{ ok: number }>('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
};
