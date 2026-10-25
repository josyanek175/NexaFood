import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hashSessionToken } from "../auth/session-token.js";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import { establishmentUsers, organizations, establishments, sessions, users } from "../db/schema/index.js";
import { AuthService } from "../services/auth-service.js";
import { createTestDb } from "../test/pglite.js";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "11111111-1111-4111-8222-222222222222";
const EST_A = "22222222-2222-4222-8222-222222222222";
const EST_B = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "Dev-Only-Pass-123!";

describe("auth API (pglite)", () => {
  const env = loadEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    SESSION_COOKIE_NAME: "nexa_session",
    SESSION_TTL_DAYS: "14",
    AUTH_LOGIN_RATE_MAX: "1000",
  });

  let app: Awaited<ReturnType<typeof buildApp>>;
  let db: Awaited<ReturnType<typeof createTestDb>>["db"];
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];
  let authService: AuthService;
  let adminId: string;
  let kitchenId: string;

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    authService = new AuthService(db, env);

    await db.insert(organizations).values([
      { id: ORG_A, name: "Org A", status: "ACTIVE" },
      { id: ORG_B, name: "Org B", status: "ACTIVE" },
    ]);
    await db.insert(establishments).values([
      {
        id: EST_A,
        organizationId: ORG_A,
        name: "Est A",
        slug: "est-a",
        status: "ACTIVE",
      },
      {
        id: EST_B,
        organizationId: ORG_B,
        name: "Est B",
        slug: "est-b",
        status: "ACTIVE",
      },
    ]);

    const admin = await authService.createUser({
      email: "Admin@Example.com",
      password: PASSWORD,
      fullName: "Admin Dev",
    });
    const kitchen = await authService.createUser({
      email: "kitchen@example.com",
      password: PASSWORD,
      fullName: "Kitchen Dev",
    });
    const blocked = await authService.createUser({
      email: "blocked@example.com",
      password: PASSWORD,
      fullName: "Blocked",
      status: "SUSPENDED",
    });
    adminId = admin.id;
    kitchenId = kitchen.id;
    void blocked;

    await db.insert(establishmentUsers).values([
      {
        establishmentId: EST_A,
        userId: adminId,
        role: "ESTABLISHMENT_ADMIN",
        active: true,
      },
      {
        establishmentId: EST_A,
        userId: kitchenId,
        role: "KITCHEN",
        active: true,
      },
    ]);

    app = await buildApp({ env, db, authService });
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    if (client) await client.close();
  });

  function cookieFrom(response: { headers: Record<string, unknown> }) {
    const raw = response.headers["set-cookie"];
    const header = Array.isArray(raw) ? raw[0] : raw;
    expect(header).toBeTruthy();
    const match = String(header).match(/nexa_session=([^;]+)/);
    expect(match?.[1]).toBeTruthy();
    return `nexa_session=${match![1]}`;
  }

  it("login válido (email case-insensitive) cria cookie e não vaza segredos", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "ADMIN@example.com", password: PASSWORD },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.email).toBe("admin@example.com");
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.passwordHash).toBeUndefined();
    expect(body.token).toBeUndefined();
    expect(body.memberships[0]?.establishmentId).toBe(EST_A);
    expect(body.currentEstablishmentId).toBe(EST_A);

    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");

    const token = setCookie.match(/nexa_session=([^;]+)/)?.[1];
    expect(token).toBeTruthy();
    const [sessionRow] = await db.select().from(sessions).where(eq(sessions.userId, adminId));
    expect(sessionRow?.tokenHash).toBe(hashSessionToken(token!));
    expect(sessionRow?.tokenHash).not.toBe(token);
  });

  it("senha inválida e email inexistente retornam mensagem genérica", async () => {
    const wrong = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: "nope" },
    });
    const missing = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "nobody@example.com", password: PASSWORD },
    });
    expect(wrong.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe("Credenciais inválidas.");
    expect(missing.json().error.message).toBe("Credenciais inválidas.");
  });

  it("usuário bloqueado não autentica", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "blocked@example.com", password: PASSWORD },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.message).toBe("Credenciais inválidas.");
  });

  it("me retorna usuário autenticado; anônimo recebe 401", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "kitchen@example.com", password: PASSWORD },
    });
    const cookie = cookieFrom(login);

    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json().user.email).toBe("kitchen@example.com");
    expect(me.json().memberships[0]?.role).toBe("KITCHEN");
    expect(me.json().user.passwordHash).toBeUndefined();

    const anon = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(anon.statusCode).toBe(401);
  });

  it("logout revoga sessão e é idempotente", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: PASSWORD },
    });
    const cookie = cookieFrom(login);
    const token = cookie.split("=")[1]!;

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { cookie },
    });
    expect(logout.statusCode).toBe(200);
    expect(String(logout.headers["set-cookie"] ?? "")).toMatch(/nexa_session=;/);

    const [row] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.tokenHash, hashSessionToken(token)));
    expect(row?.revokedAt).toBeTruthy();

    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);

    const again = await app.inject({ method: "POST", url: "/api/v1/auth/logout" });
    expect(again.statusCode).toBe(200);
  });

  it("current-establishment aceita A e rejeita B", async () => {
    // Give admin membership only on A (already). Login and try B.
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: PASSWORD },
    });
    const cookie = cookieFrom(login);

    const ok = await app.inject({
      method: "POST",
      url: "/api/v1/auth/current-establishment",
      headers: { cookie },
      payload: { establishmentId: EST_A },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().currentEstablishmentId).toBe(EST_A);

    const denied = await app.inject({
      method: "POST",
      url: "/api/v1/auth/current-establishment",
      headers: { cookie },
      payload: { establishmentId: EST_B },
    });
    expect(denied.statusCode).toBe(403);
  });

  it("sessão expirada é rejeitada", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: PASSWORD },
    });
    const cookie = cookieFrom(login);
    const token = cookie.split("=")[1]!;

    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.tokenHash, hashSessionToken(token)));

    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me", headers: { cookie } });
    expect(me.statusCode).toBe(401);
  });

  it("não há token em plaintext nas sessions", async () => {
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@example.com", password: PASSWORD },
    });
    const token = cookieFrom(login).split("=")[1]!;
    const rows = await db.select().from(sessions).where(and(eq(sessions.userId, adminId)));
    for (const row of rows) {
      expect(row.tokenHash).not.toBe(token);
      expect(row.tokenHash.length).toBe(64);
    }
    // silence unused import warning if users unused - we use users table indirectly
    void users;
  });
});
