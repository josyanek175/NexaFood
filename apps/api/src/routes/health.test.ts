import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { loadEnv } from "../config/env.js";

describe("GET /health", () => {
  const env = loadEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    PORT: "3333",
    HOST: "127.0.0.1",
  });

  it("retorna status ok", async () => {
    const app = await buildApp({ env, pool: null });
    try {
      const response = await app.inject({ method: "GET", url: "/health" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
      expect(response.headers["x-request-id"]).toBeTruthy();
    } finally {
      await app.close();
    }
  });

  it("GET /health/db retorna not_configured sem DATABASE_URL", async () => {
    const app = await buildApp({ env, pool: null });
    try {
      const response = await app.inject({ method: "GET", url: "/health/db" });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toMatchObject({
        status: "error",
        database: "not_configured",
      });
    } finally {
      await app.close();
    }
  });

  it("GET /health/db retorna up com pool mockado", async () => {
    const pool = {
      query: async () => ({ rows: [{ ok: 1 }] }),
    } as unknown as import("pg").Pool;

    const app = await buildApp({ env, pool });
    try {
      const response = await app.inject({ method: "GET", url: "/health/db" });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok", database: "up" });
    } finally {
      await app.close();
    }
  });
});
