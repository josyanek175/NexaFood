import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import {
  establishmentUsers,
  establishments,
  organizations,
  restaurantTables,
} from "../db/schema/index.js";
import { AuthService } from "../services/auth-service.js";
import { createTestDb } from "../test/pglite.js";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11";
const EST_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb11";
const EST_B = "cccccccc-cccc-4ccc-8ccc-cccccccccc11";
const PASSWORD = "Dev-Only-Pass-123!";

describe("tables API (pglite)", () => {
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
  let cookie: string;
  let tableB: string;

  function cookieFrom(response: { headers: Record<string, unknown> }) {
    const raw = response.headers["set-cookie"];
    const header = Array.isArray(raw) ? raw[0] : raw;
    const match = String(header).match(/nexa_session=([^;]+)/);
    return `nexa_session=${match![1]}`;
  }

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    const authService = new AuthService(db, env);

    await db.insert(organizations).values({ id: ORG, name: "Org", status: "ACTIVE" });
    await db.insert(establishments).values([
      {
        id: EST_A,
        organizationId: ORG,
        name: "Est A",
        slug: "table-est-a",
        status: "ACTIVE",
        isOpen: true,
      },
      {
        id: EST_B,
        organizationId: ORG,
        name: "Est B",
        slug: "table-est-b",
        status: "ACTIVE",
        isOpen: true,
      },
    ]);

    const [tB] = await db
      .insert(restaurantTables)
      .values({ establishmentId: EST_B, number: 9, seats: 4 })
      .returning();
    tableB = tB!.id;

    const user = await authService.createUser({
      email: "tables@example.com",
      password: PASSWORD,
      fullName: "Tables Admin",
    });
    await db.insert(establishmentUsers).values({
      establishmentId: EST_A,
      userId: user.id,
      role: "ESTABLISHMENT_ADMIN",
      active: true,
    });

    app = await buildApp({ env, db, authService });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "tables@example.com", password: PASSWORD },
    });
    cookie = cookieFrom(login);
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/current-establishment",
      headers: { cookie },
      payload: { establishmentId: EST_A },
    });
  }, 90_000);

  afterAll(async () => {
    if (app) await app.close();
    if (client) await client.close();
  });

  it("cria, abre, fecha mesa e gera qrPath do tenant", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/tables",
      headers: { cookie },
      payload: { number: 3, seats: 6 },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().qrPath).toBe("/table-est-a?mesa=3");
    expect(created.json().status).toBe("LIVRE");

    const opened = await app.inject({
      method: "POST",
      url: `/api/v1/tables/${created.json().id}/open`,
      headers: { cookie },
    });
    expect(opened.statusCode).toBe(200);
    expect(opened.json().status).toBe("AGUARDANDO_PEDIDO");
    expect(opened.json().openedAt).toBeTruthy();

    const closed = await app.inject({
      method: "POST",
      url: `/api/v1/tables/${created.json().id}/close`,
      headers: { cookie },
      payload: {},
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json().status).toBe("LIVRE");
    expect(closed.json().openedAt).toBeNull();
  });

  it("não acessa mesa de outro tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/tables/${tableB}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("lista apenas mesas do estabelecimento atual", async () => {
    const list = await app.inject({
      method: "GET",
      url: "/api/v1/tables",
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().every((t: { number: number }) => t.number !== 9)).toBe(true);
  });
});
