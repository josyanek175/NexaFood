import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import type { Env } from "../config/env.js";
import * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

export function createPool(env: Env): pg.Pool {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database connections");
  }
  return new pg.Pool({
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
  });
}

export function createDb(pool: pg.Pool): Database {
  return drizzle(pool, { schema });
}
