import type { FastifyPluginAsync } from "fastify";
import type { Pool } from "pg";

export type HealthRoutesOpts = {
  pool: Pool | null;
};

const healthRoutes: FastifyPluginAsync<HealthRoutesOpts> = async (app, opts) => {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/health/db", async (_request, reply) => {
    if (!opts.pool) {
      return reply.status(503).send({
        status: "error",
        database: "not_configured",
        message: "DATABASE_URL is not set",
      });
    }

    try {
      await opts.pool.query("select 1 as ok");
      return { status: "ok", database: "up" };
    } catch (error) {
      app.log.error({ err: error }, "Database health check failed");
      return reply.status(503).send({
        status: "error",
        database: "down",
        message: "Database connection failed",
      });
    }
  });
};

export default healthRoutes;
