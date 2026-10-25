import { describe, expect, it } from "vitest";
import { loadEnv, resolveCorsOrigins } from "./env.js";

describe("resolveCorsOrigins", () => {
  it("em development permite localhost do Vite por padrão", () => {
    const env = loadEnv({ NODE_ENV: "development", LOG_LEVEL: "silent" });
    const origins = resolveCorsOrigins(env);
    expect(origins).toContain("http://localhost:5173");
  });

  it("em production não usa wildcard e exige lista explícita", () => {
    const env = loadEnv({ NODE_ENV: "production", LOG_LEVEL: "silent" });
    expect(resolveCorsOrigins(env)).toBe(false);

    const envConfigured = loadEnv({
      NODE_ENV: "production",
      LOG_LEVEL: "silent",
      CORS_ORIGINS: "https://app.example.com, https://admin.example.com",
    });
    expect(resolveCorsOrigins(envConfigured)).toEqual([
      "https://app.example.com",
      "https://admin.example.com",
    ]);
  });
});
