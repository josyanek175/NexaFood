import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  /**
   * Comma-separated origins allowed by CORS in production.
   * In development, localhost Vite ports are allowed by default.
   */
  CORS_ORIGINS: z.string().optional(),
  SESSION_COOKIE_NAME: z.string().min(1).default("nexa_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(14),
  /** Optional password pepper mixed into hashes. Never expose to frontend. */
  PASSWORD_PEPPER: z.string().optional(),
  /** Used only by db:seed in non-production. */
  DEV_SEED_PASSWORD: z.string().optional(),
  AUTH_LOGIN_RATE_MAX: z.coerce.number().int().positive().default(10),
  AUTH_LOGIN_RATE_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

const DEV_CORS_DEFAULTS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export function resolveCorsOrigins(env: Env): boolean | string[] {
  const configured = (env.CORS_ORIGINS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (env.NODE_ENV === "production") {
    return configured.length > 0 ? configured : false;
  }

  return configured.length > 0 ? configured : DEV_CORS_DEFAULTS;
}

export function loadEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}
