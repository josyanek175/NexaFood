import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import { establishmentUsers, establishments, organizations } from "../db/schema/index.js";
import { AuthService } from "../services/auth-service.js";
import { createTestDb } from "../test/pglite.js";

const ORG = "dddddddd-dddd-4ddd-8ddd-dddddddddd01";
const EST_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01";
const EST_B = "ffffffff-ffff-4fff-8fff-ffffffffff01";
const PASSWORD = "Dev-Only-Pass-123!";

describe("establishment settings (pglite)", () => {
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
        slug: "settings-a",
        status: "ACTIVE",
        isOpen: true,
        serviceFeePercentage: "10",
      },
      {
        id: EST_B,
        organizationId: ORG,
        name: "Est B",
        slug: "settings-b",
        status: "ACTIVE",
        isOpen: false,
      },
    ]);

    const user = await authService.createUser({
      email: "settings@example.com",
      password: PASSWORD,
      fullName: "Settings",
    });
    await db.insert(establishmentUsers).values([
      { establishmentId: EST_A, userId: user.id, role: "ESTABLISHMENT_ADMIN", active: true },
      { establishmentId: EST_B, userId: user.id, role: "MANAGER", active: true },
    ]);

    app = await buildApp({ env, db, authService });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "settings@example.com", password: PASSWORD },
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

  it("lê e atualiza configurações só do estabelecimento atual", async () => {
    const current = await app.inject({
      method: "GET",
      url: "/api/v1/establishment/settings",
      headers: { cookie },
    });
    expect(current.statusCode).toBe(200);
    expect(current.json().name).toBe("Est A");
    expect(current.json().slug).toBe("settings-a");
    expect(current.json().businessHours).toHaveLength(7);
    expect(current.json().serviceFeePercentage).toBe(10);

    const saved = await app.inject({
      method: "PATCH",
      url: "/api/v1/establishment/settings",
      headers: { cookie },
      payload: {
        name: "Nexa Centro",
        whatsapp: "5511999990000",
        isOpen: false,
        minimumOrder: 25,
        estimatedTimeMin: 20,
        estimatedTimeMax: 35,
        serviceFeePercentage: 8.5,
        businessHours: [
          { weekday: 0, opens: "12:00", closes: "22:00", closed: false },
          { weekday: 1, opens: "18:00", closes: "23:00", closed: true },
        ],
      },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().name).toBe("Nexa Centro");
    expect(saved.json().whatsapp).toBe("5511999990000");
    expect(saved.json().isOpen).toBe(false);
    expect(saved.json().minimumOrder).toBe(25);
    expect(saved.json().serviceFeePercentage).toBe(8.5);
    expect(saved.json().businessHours[0]).toMatchObject({
      weekday: 0,
      opens: "12:00",
      closes: "22:00",
      closed: false,
    });
    expect(saved.json().businessHours[1].closed).toBe(true);

    const menu = await app.inject({
      method: "GET",
      url: "/api/v1/public/establishments/settings-a/menu",
    });
    expect(menu.statusCode).toBe(200);
    expect(menu.json().establishment.name).toBe("Nexa Centro");
    expect(menu.json().establishment.isOpen).toBe(false);
    expect(menu.json().businessHours[1].closed).toBe(true);

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/current-establishment",
      headers: { cookie },
      payload: { establishmentId: EST_B },
    });
    const other = await app.inject({
      method: "GET",
      url: "/api/v1/establishment/settings",
      headers: { cookie },
    });
    expect(other.json().name).toBe("Est B");
    expect(other.json().slug).toBe("settings-b");
  });

  it("rejeita tempo máximo menor que o mínimo", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/current-establishment",
      headers: { cookie },
      payload: { establishmentId: EST_A },
    });
    const saved = await app.inject({
      method: "PATCH",
      url: "/api/v1/establishment/settings",
      headers: { cookie },
      payload: { estimatedTimeMin: 40, estimatedTimeMax: 10 },
    });
    expect(saved.statusCode).toBe(400);
  });
});
