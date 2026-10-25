import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";
import { createPool } from "./db/client.js";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

async function main() {
  const env = loadEnv();
  const pool = env.DATABASE_URL ? createPool(env) : null;

  const app = await buildApp({ env, pool });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    if (pool) await pool.end();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`NexaFood API listening on http://${env.HOST}:${env.PORT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
