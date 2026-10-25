import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../db/schema/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const drizzleDir = path.join(here, "../../drizzle");

/** Adapt production migrations for PGlite (no pgcrypto extension). */
function adaptSqlForPglite(sql: string): string {
  return sql
    .replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;\s*/gi, "")
    .replace(/EXECUTE FUNCTION/gi, "EXECUTE PROCEDURE");
}

export async function createTestDb() {
  const client = new PGlite();
  const sqlFiles = [
    "0000_nexafood_foundation.sql",
    "0001_auth_sessions.sql",
    "0002_tenant_same_tenant_fks.sql",
    "0003_products_active_available.sql",
    "0004_order_item_kitchen_status.sql",
  ];
  for (const file of sqlFiles) {
    const sql = adaptSqlForPglite(readFileSync(path.join(drizzleDir, file), "utf8"));
    await client.exec(sql);
  }
  const db = drizzle(client, { schema });
  return { client, db };
}
