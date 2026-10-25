import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import {
  categories,
  establishmentUsers,
  establishments,
  kitchenSectors,
  optionGroups,
  organizations,
  productOptionGroups,
  productVariations,
  products,
} from "../db/schema/index.js";
import { AuthService } from "../services/auth-service.js";
import { createTestDb } from "../test/pglite.js";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EST_A = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EST_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PASSWORD = "Dev-Only-Pass-123!";

describe("products CRUD (pglite)", () => {
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
  let cookieA: string;

  let categoryA: string;
  let categoryB: string;
  let sectorA: string;
  let sectorB: string;
  let optionGroupA: string;
  let optionGroupB: string;
  let productB: string;

  function cookieFrom(response: { headers: Record<string, unknown> }) {
    const raw = response.headers["set-cookie"];
    const header = Array.isArray(raw) ? raw[0] : raw;
    const match = String(header).match(/nexa_session=([^;]+)/);
    return `nexa_session=${match![1]}`;
  }

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    authService = new AuthService(db, env);

    await db.insert(organizations).values({ id: ORG_A, name: "Org", status: "ACTIVE" });
    await db.insert(establishments).values([
      {
        id: EST_A,
        organizationId: ORG_A,
        name: "Est A",
        slug: "prod-est-a",
        status: "ACTIVE",
        isOpen: true,
      },
      {
        id: EST_B,
        organizationId: ORG_A,
        name: "Est B",
        slug: "prod-est-b",
        status: "ACTIVE",
        isOpen: true,
      },
    ]);

    const [sA] = await db
      .insert(kitchenSectors)
      .values({ establishmentId: EST_A, name: "Cozinha A", type: "COZINHA" })
      .returning();
    const [sB] = await db
      .insert(kitchenSectors)
      .values({ establishmentId: EST_B, name: "Cozinha B", type: "COZINHA" })
      .returning();
    sectorA = sA!.id;
    sectorB = sB!.id;

    const [cA] = await db
      .insert(categories)
      .values({ establishmentId: EST_A, name: "Cat A", active: true })
      .returning();
    const [cB] = await db
      .insert(categories)
      .values({ establishmentId: EST_B, name: "Cat B", active: true })
      .returning();
    categoryA = cA!.id;
    categoryB = cB!.id;

    const [ogA] = await db
      .insert(optionGroups)
      .values({ establishmentId: EST_A, name: "Extras A", active: true })
      .returning();
    const [ogB] = await db
      .insert(optionGroups)
      .values({ establishmentId: EST_B, name: "Extras B", active: true })
      .returning();
    optionGroupA = ogA!.id;
    optionGroupB = ogB!.id;

    const [pB] = await db
      .insert(products)
      .values({
        establishmentId: EST_B,
        categoryId: categoryB,
        sectorId: sectorB,
        name: "Burger B",
        price: "25",
        active: true,
        available: true,
        channels: ["cardapio"],
      })
      .returning();
    productB = pB!.id;

    const admin = await authService.createUser({
      email: "catalog@example.com",
      password: PASSWORD,
      fullName: "Catalog Admin",
    });
    await db.insert(establishmentUsers).values([
      { establishmentId: EST_A, userId: admin.id, role: "ESTABLISHMENT_ADMIN", active: true },
      { establishmentId: EST_B, userId: admin.id, role: "MANAGER", active: true },
    ]);

    app = await buildApp({ env, db, authService });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "catalog@example.com", password: PASSWORD },
    });
    cookieA = cookieFrom(login);

    await app.inject({
      method: "POST",
      url: "/api/v1/auth/current-establishment",
      headers: { cookie: cookieA },
      payload: { establishmentId: EST_A },
    });
  }, 90_000);

  afterAll(async () => {
    if (app) await app.close();
    if (client) await client.close();
  });

  it("tenant A não lista produtos de B", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as Array<{ name: string }>;
    expect(body.every((p) => p.name !== "Burger B")).toBe(true);
  });

  it("tenant A não consulta produto de B por ID", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/products/${productB}`,
      headers: { cookie: cookieA },
    });
    expect(res.statusCode).toBe(404);
  });

  it("tenant A não cria produto usando categoria de B", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Hack Cat",
        price: 10,
        categoryId: categoryB,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("tenant A não usa setor de B", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Hack Sector",
        price: 10,
        sectorId: sectorB,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("tenant A não vincula option group de B", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Hack OG",
        price: 10,
        optionGroupIds: [optionGroupB],
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("cria/edita produto com variations e option groups (replace set)", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "X-Burger",
        description: "Clássico",
        price: 22.5,
        promoPrice: 19.9,
        categoryId: categoryA,
        sectorId: sectorA,
        active: true,
        available: true,
        featured: true,
        prepMinutes: 12,
        sku: "XB-01",
        position: 1,
        channels: ["cardapio", "mesa"],
        removableIngredients: ["cebola"],
        variations: [
          { name: "Simples", priceDelta: 0, available: true },
          { name: "Duplo", priceDelta: 5, available: false },
        ],
        optionGroupIds: [optionGroupA],
      },
    });
    expect(create.statusCode).toBe(200);
    const created = create.json();
    expect(created.active).toBe(true);
    expect(created.available).toBe(true);
    expect(created.variations).toHaveLength(2);
    expect(created.optionGroups).toHaveLength(1);
    expect(created.optionGroups[0].id).toBe(optionGroupA);

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v1/products/${created.id}`,
      headers: { cookie: cookieA },
      payload: {
        name: "X-Burger Edit",
        variations: [{ id: created.variations[0].id, name: "Única", priceDelta: 0 }],
        optionGroupIds: [],
      },
    });
    expect(patch.statusCode).toBe(200);
    const updated = patch.json();
    expect(updated.name).toBe("X-Burger Edit");
    expect(updated.variations).toHaveLength(1);
    expect(updated.variations[0].name).toBe("Única");
    expect(updated.optionGroups).toHaveLength(0);
  });

  it("PATCH não move produto para referências de outro tenant", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: { name: "Patch Target", price: 15, categoryId: categoryA },
    });
    const id = create.json().id as string;

    const badCat = await app.inject({
      method: "PATCH",
      url: `/api/v1/products/${id}`,
      headers: { cookie: cookieA },
      payload: { categoryId: categoryB },
    });
    expect(badCat.statusCode).toBe(403);

    const badSector = await app.inject({
      method: "PATCH",
      url: `/api/v1/products/${id}`,
      headers: { cookie: cookieA },
      payload: { sectorId: sectorB },
    });
    expect(badSector.statusCode).toBe(403);

    const badOg = await app.inject({
      method: "PATCH",
      url: `/api/v1/products/${id}`,
      headers: { cookie: cookieA },
      payload: { optionGroupIds: [optionGroupB] },
    });
    expect(badOg.statusCode).toBe(403);
  });

  it("produto inativo não aparece no menu público; ativo+indisponível aparece esgotado", async () => {
    const inactive = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Inativo Hidden",
        price: 10,
        active: false,
        available: true,
        channels: ["cardapio"],
      },
    });
    const soldOut = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Esgotado Visible",
        price: 11,
        active: true,
        available: false,
        channels: ["cardapio"],
      },
    });
    expect(inactive.statusCode).toBe(200);
    expect(soldOut.statusCode).toBe(200);

    const menu = await app.inject({
      method: "GET",
      url: "/api/v1/public/establishments/prod-est-a/menu",
    });
    expect(menu.statusCode).toBe(200);
    const productsMenu = menu.json().products as Array<{ name: string; available: boolean }>;
    expect(productsMenu.every((p) => p.name !== "Inativo Hidden")).toBe(true);
    const sold = productsMenu.find((p) => p.name === "Esgotado Visible");
    expect(sold).toBeTruthy();
    expect(sold!.available).toBe(false);
  });

  it("produto indisponível e variação indisponível não podem ser comprados", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Order Guard",
        price: 18,
        active: true,
        available: false,
        channels: ["cardapio"],
        variations: [{ name: "Grande", priceDelta: 2, available: false }],
      },
    });
    const product = create.json();
    const variationId = product.variations[0].id as string;

    const soldOutOrder = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "prod-est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "Cliente",
        items: [{ productId: product.id, quantity: 1 }],
      },
    });
    expect(soldOutOrder.statusCode).toBe(400);
    expect(soldOutOrder.json().error.message).toMatch(/esgotado/i);

    await db
      .update(products)
      .set({ available: true })
      .where(and(eq(products.id, product.id), eq(products.establishmentId, EST_A)));

    const badVariation = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "prod-est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "Cliente",
        items: [{ productId: product.id, quantity: 1, variationId }],
      },
    });
    expect(badVariation.statusCode).toBe(400);
    expect(badVariation.json().error.message).toMatch(/varia/i);
  });

  it("rollback completo se criação composta falhar", async () => {
    const before = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.establishmentId, EST_A));

    // Invalid variation id forces failure after product INSERT inside the transaction.
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Should Rollback",
        price: 9,
        variations: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            name: "Ghost",
            priceDelta: 0,
          },
        ],
        optionGroupIds: [optionGroupA],
      },
    });
    expect(res.statusCode).toBe(400);

    const after = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.establishmentId, EST_A));
    expect(after.map((r) => r.id).sort()).toEqual(before.map((r) => r.id).sort());

    const rolledBackName = await db
      .select()
      .from(products)
      .where(and(eq(products.establishmentId, EST_A), eq(products.name, "Should Rollback")));
    expect(rolledBackName).toHaveLength(0);

    const orphanVars = await db
      .select()
      .from(productVariations)
      .where(eq(productVariations.establishmentId, EST_A));
    const orphanLinks = await db
      .select()
      .from(productOptionGroups)
      .where(eq(productOptionGroups.establishmentId, EST_A));
    expect(orphanVars.every((v) => after.some((p) => p.id === v.productId))).toBe(true);
    expect(orphanLinks.every((l) => after.some((p) => p.id === l.productId))).toBe(true);
  });

  it("GET /products filtra por nome/categoria/active/available e ordena por position", async () => {
    await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Alpha Filter",
        price: 1,
        categoryId: categoryA,
        active: true,
        available: true,
        position: 30,
      },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Beta Filter",
        price: 2,
        categoryId: categoryA,
        active: false,
        available: true,
        position: 10,
      },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: { cookie: cookieA },
      payload: {
        name: "Gamma Soldout",
        price: 3,
        categoryId: categoryA,
        active: true,
        available: false,
        position: 20,
      },
    });

    const byName = await app.inject({
      method: "GET",
      url: "/api/v1/products?q=Alpha",
      headers: { cookie: cookieA },
    });
    expect(byName.json().every((p: { name: string }) => p.name.includes("Alpha"))).toBe(true);

    const inactive = await app.inject({
      method: "GET",
      url: "/api/v1/products?active=false",
      headers: { cookie: cookieA },
    });
    expect(inactive.json().every((p: { active: boolean }) => p.active === false)).toBe(true);

    const soldOut = await app.inject({
      method: "GET",
      url: "/api/v1/products?available=false",
      headers: { cookie: cookieA },
    });
    expect(soldOut.json().every((p: { available: boolean }) => p.available === false)).toBe(true);

    const byCat = await app.inject({
      method: "GET",
      url: `/api/v1/products?categoryId=${categoryA}`,
      headers: { cookie: cookieA },
    });
    const positions = (byCat.json() as Array<{ position: number }>).map((p) => p.position);
    const sorted = [...positions].sort((a, b) => a - b);
    expect(positions).toEqual(sorted);
  });
});
