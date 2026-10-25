import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import {
  categories,
  establishmentUsers,
  establishments,
  optionGroups,
  organizations,
} from "../db/schema/index.js";
import { AuthService } from "../services/auth-service.js";
import { createTestDb } from "../test/pglite.js";

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01";
const EST_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01";
const EST_B = "cccccccc-cccc-4ccc-8ccc-cccccccccc01";
const PASSWORD = "Dev-Only-Pass-123!";

describe("catalog categories + option groups (pglite)", () => {
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
  let categoryB: string;
  let groupB: string;

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
        slug: "cat-est-a",
        status: "ACTIVE",
        isOpen: true,
      },
      {
        id: EST_B,
        organizationId: ORG,
        name: "Est B",
        slug: "cat-est-b",
        status: "ACTIVE",
        isOpen: true,
      },
    ]);

    const [cB] = await db
      .insert(categories)
      .values({ establishmentId: EST_B, name: "Cat B", active: true })
      .returning();
    categoryB = cB!.id;

    const [gB] = await db
      .insert(optionGroups)
      .values({ establishmentId: EST_B, name: "Grupo B", active: true })
      .returning();
    groupB = gB!.id;

    const user = await authService.createUser({
      email: "catalog-crud@example.com",
      password: PASSWORD,
      fullName: "Catalog",
    });
    await db.insert(establishmentUsers).values([
      { establishmentId: EST_A, userId: user.id, role: "ESTABLISHMENT_ADMIN", active: true },
      { establishmentId: EST_B, userId: user.id, role: "MANAGER", active: true },
    ]);

    app = await buildApp({ env, db, authService });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "catalog-crud@example.com", password: PASSWORD },
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

  it("cria e lista categoria só do tenant atual", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/categories",
      headers: { cookie },
      payload: { name: "Burgers", position: 1, active: true },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().name).toBe("Burgers");

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/categories",
      headers: { cookie },
    });
    expect(list.statusCode).toBe(200);
    const names = list.json().map((c: { name: string }) => c.name);
    expect(names).toContain("Burgers");
    expect(names).not.toContain("Cat B");
  });

  it("não consulta categoria de outro tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/categories/${categoryB}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("cria grupo com items (replace set) e rejeita min>max", async () => {
    const bad = await app.inject({
      method: "POST",
      url: "/api/v1/option-groups",
      headers: { cookie },
      payload: { name: "Bad", minSelect: 3, maxSelect: 1 },
    });
    expect(bad.statusCode).toBe(400);

    const created = await app.inject({
      method: "POST",
      url: "/api/v1/option-groups",
      headers: { cookie },
      payload: {
        name: "Extras",
        required: true,
        minSelect: 1,
        maxSelect: 2,
        selection: "multiple",
        items: [
          { name: "Bacon", price: 4 },
          { name: "Queijo", price: 3, available: false },
        ],
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().items).toHaveLength(2);

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/v1/option-groups/${created.json().id}`,
      headers: { cookie },
      payload: {
        items: [{ id: created.json().items[0].id, name: "Bacon crispy", price: 5 }],
      },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().items).toHaveLength(1);
    expect(patched.json().items[0].name).toBe("Bacon crispy");
  });

  it("não consulta option group de outro tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/option-groups/${groupB}`,
      headers: { cookie },
    });
    expect(res.statusCode).toBe(404);
  });
});
