import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import {
  categories,
  customers,
  establishmentUsers,
  establishments,
  kitchenSectors,
  optionGroups,
  optionItems,
  organizations,
  orders,
  platformAdmins,
  productOptionGroups,
  productVariations,
  products,
  restaurantTables,
} from "../db/schema/index.js";
import { AuthService } from "../services/auth-service.js";
import { createTestDb } from "../test/pglite.js";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "11111111-1111-4111-8222-222222222222";
const EST_A = "22222222-2222-4222-8222-222222222222";
const EST_B = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "Dev-Only-Pass-123!";

describe("tenant security (pglite)", () => {
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

  let productA: string;
  let productB: string;
  let variationA: string;
  let variationB: string;
  let optionItemA: string;
  let optionItemB: string;
  let optionGroupA: string;
  let tableA: string;
  let tableB: string;
  let customerA: string;
  let customerB: string;
  let dualCookie: string;
  let platformCookie: string;

  function cookieFrom(response: { headers: Record<string, unknown> }) {
    const raw = response.headers["set-cookie"];
    const header = Array.isArray(raw) ? raw[0] : raw;
    const match = String(header).match(/nexa_session=([^;]+)/);
    return `nexa_session=${match![1]}`;
  }

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    authService = new AuthService(db, env);

    await db.insert(organizations).values([
      { id: ORG_A, name: "Org Shared", status: "ACTIVE" },
      { id: ORG_B, name: "Org Other", status: "ACTIVE" },
    ]);
    await db.insert(establishments).values([
      {
        id: EST_A,
        organizationId: ORG_A,
        name: "Est A",
        slug: "est-a",
        status: "ACTIVE",
        isOpen: true,
        serviceFeePercentage: "0",
      },
      {
        id: EST_B,
        organizationId: ORG_A, // same org — must NOT auto-grant
        name: "Est B",
        slug: "est-b",
        status: "ACTIVE",
        isOpen: true,
      },
    ]);

    const [sectorA] = await db
      .insert(kitchenSectors)
      .values({ establishmentId: EST_A, name: "Cozinha A", type: "COZINHA" })
      .returning();
    const [sectorB] = await db
      .insert(kitchenSectors)
      .values({ establishmentId: EST_B, name: "Cozinha B", type: "COZINHA" })
      .returning();
    const [catA] = await db
      .insert(categories)
      .values({ establishmentId: EST_A, name: "Cat A", active: true })
      .returning();
    const [catB] = await db
      .insert(categories)
      .values({ establishmentId: EST_B, name: "Cat B", active: true })
      .returning();

    const [ogA] = await db
      .insert(optionGroups)
      .values({ establishmentId: EST_A, name: "Extras A", active: true })
      .returning();
    const [ogB] = await db
      .insert(optionGroups)
      .values({ establishmentId: EST_B, name: "Extras B", active: true })
      .returning();
    optionGroupA = ogA!.id;

    const [oiA] = await db
      .insert(optionItems)
      .values({
        establishmentId: EST_A,
        optionGroupId: ogA!.id,
        name: "Bacon",
        price: "2",
        available: true,
      })
      .returning();
    const [oiB] = await db
      .insert(optionItems)
      .values({
        establishmentId: EST_B,
        optionGroupId: ogB!.id,
        name: "Cheese",
        price: "3",
        available: true,
      })
      .returning();
    optionItemA = oiA!.id;
    optionItemB = oiB!.id;

    const [pA] = await db
      .insert(products)
      .values({
        establishmentId: EST_A,
        categoryId: catA!.id,
        sectorId: sectorA!.id,
        name: "Burger A",
        price: "20",
        available: true,
        channels: ["cardapio"],
      })
      .returning();
    const [pB] = await db
      .insert(products)
      .values({
        establishmentId: EST_B,
        categoryId: catB!.id,
        sectorId: sectorB!.id,
        name: "Burger B",
        price: "25",
        available: true,
        channels: ["cardapio"],
      })
      .returning();
    productA = pA!.id;
    productB = pB!.id;

    const [vA] = await db
      .insert(productVariations)
      .values({ establishmentId: EST_A, productId: productA, name: "Simples", priceDelta: "0" })
      .returning();
    const [vB] = await db
      .insert(productVariations)
      .values({ establishmentId: EST_B, productId: productB, name: "Duplo", priceDelta: "5" })
      .returning();
    variationA = vA!.id;
    variationB = vB!.id;

    await db.insert(productOptionGroups).values({
      establishmentId: EST_A,
      productId: productA,
      optionGroupId: optionGroupA,
    });

    const [tA] = await db
      .insert(restaurantTables)
      .values({ establishmentId: EST_A, number: 1, seats: 4 })
      .returning();
    const [tB] = await db
      .insert(restaurantTables)
      .values({ establishmentId: EST_B, number: 1, seats: 4 })
      .returning();
    tableA = tA!.id;
    tableB = tB!.id;

    const [cA] = await db
      .insert(customers)
      .values({ establishmentId: EST_A, name: "Cliente A", phone: "111" })
      .returning();
    const [cB] = await db
      .insert(customers)
      .values({ establishmentId: EST_B, name: "Cliente B", phone: "222" })
      .returning();
    customerA = cA!.id;
    customerB = cB!.id;

    const dual = await authService.createUser({
      email: "dual@example.com",
      password: PASSWORD,
      fullName: "Dual User",
    });
    await db.insert(establishmentUsers).values([
      { establishmentId: EST_A, userId: dual.id, role: "ESTABLISHMENT_ADMIN", active: true },
      { establishmentId: EST_B, userId: dual.id, role: "MANAGER", active: true },
    ]);

    const platform = await authService.createUser({
      email: "platform@example.com",
      password: PASSWORD,
      fullName: "Platform",
    });
    await db.insert(platformAdmins).values({ userId: platform.id });

    app = await buildApp({ env, db, authService });

    const loginDual = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "dual@example.com", password: PASSWORD },
    });
    dualCookie = cookieFrom(loginDual);

    const loginPlatform = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "platform@example.com", password: PASSWORD },
    });
    platformCookie = cookieFrom(loginPlatform);
  }, 90_000);

  afterAll(async () => {
    if (app) await app.close();
    if (client) await client.close();
  });

  async function setCurrent(establishmentId: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/current-establishment",
      headers: { cookie: dualCookie },
      payload: { establishmentId },
    });
    expect(res.statusCode).toBe(200);
    // cookie may be refreshed; keep original session cookie (same session updated server-side)
  }

  it("1-2 current=A lista A e não B", async () => {
    await setCurrent(EST_A);
    const menu = await app.inject({
      method: "GET",
      url: "/api/v1/admin/menu",
      headers: { cookie: dualCookie },
    });
    expect(menu.statusCode).toBe(200);
    const names = menu.json().products.map((p: { name: string }) => p.name);
    expect(names).toContain("Burger A");
    expect(names).not.toContain("Burger B");

    const tables = await app.inject({
      method: "GET",
      url: "/api/v1/tables",
      headers: { cookie: dualCookie },
    });
    expect(tables.json().every((t: { establishmentId: string }) => t.establishmentId === EST_A)).toBe(
      true,
    );
  });

  it("3 membership A+B com current=A não opera B", async () => {
    await setCurrent(EST_A);
    const tableBGet = await app.inject({
      method: "GET",
      url: `/api/v1/tables/${tableB}`,
      headers: { cookie: dualCookie },
    });
    // Same-tenant miss returns 404 (no existence leak across tenants).
    expect(tableBGet.statusCode).toBe(404);

    const customerBGet = await app.inject({
      method: "GET",
      url: `/api/v1/customers/${customerB}`,
      headers: { cookie: dualCookie },
    });
    expect(customerBGet.statusCode).toBe(403);
  });

  it("4 após trocar current para B opera B", async () => {
    await setCurrent(EST_B);
    const menu = await app.inject({
      method: "GET",
      url: "/api/v1/admin/menu",
      headers: { cookie: dualCookie },
    });
    expect(menu.json().products.map((p: { name: string }) => p.name)).toContain("Burger B");

    const table = await app.inject({
      method: "GET",
      url: `/api/v1/tables/${tableB}`,
      headers: { cookie: dualCookie },
    });
    expect(table.statusCode).toBe(200);
  });

  it("5-7 order/customer/table B bloqueados com current=A", async () => {
    // Place order on B
    const placed = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-b",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "X",
        items: [{ productId: productB, quantity: 1 }],
      },
    });
    expect(placed.statusCode).toBe(200);
    const listB = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { cookie: dualCookie },
    });
    // ensure current is B for list then switch
    await setCurrent(EST_B);
    const ordersB = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { cookie: dualCookie },
    });
    const orderBId = ordersB.json()[0]?.id as string;
    expect(orderBId).toBeTruthy();

    await setCurrent(EST_A);
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/v1/orders/${orderBId}/status`,
      headers: { cookie: dualCookie },
      payload: { status: "PREPARANDO" },
    });
    expect(patch.statusCode).toBe(404);

    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/customers/${customerB}`,
          headers: { cookie: dualCookie },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/tables/${tableB}`,
          headers: { cookie: dualCookie },
        })
      ).statusCode,
    ).toBe(404);
    void listB;
  });

  it("8 mesma organization não dá acesso automático (já coberto por membership)", async () => {
    // Dual has memberships on both of same org — isolation still via current.
    await setCurrent(EST_A);
    const menu = await app.inject({
      method: "GET",
      url: "/api/v1/admin/menu",
      headers: { cookie: dualCookie },
    });
    expect(menu.json().products.every((p: { name: string }) => p.name !== "Burger B")).toBe(true);
  });

  it("9 platform admin sem contexto não acessa ops", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { cookie: platformCookie },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("ESTABLISHMENT_CONTEXT_REQUIRED");
  });

  it("10-16 placeOrder rejeita cross-tenant e vínculos inválidos", async () => {
    const productBOnA = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "X",
        items: [{ productId: productB, quantity: 1 }],
      },
    });
    expect(productBOnA.statusCode).toBe(403);

    const badVariationOtherProduct = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "X",
        items: [{ productId: productA, variationId: variationB, quantity: 1 }],
      },
    });
    expect(badVariationOtherProduct.statusCode).toBe(400);

    const optionBOnA = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "X",
        items: [{ productId: productA, quantity: 1, optionItemIds: [optionItemB] }],
      },
    });
    expect(optionBOnA.statusCode).toBe(403);

    // Unlinked option: create orphan group/item on A not linked to productA
    const [orphanGroup] = await db
      .insert(optionGroups)
      .values({ establishmentId: EST_A, name: "Orphan", active: true })
      .returning();
    const [orphanItem] = await db
      .insert(optionItems)
      .values({
        establishmentId: EST_A,
        optionGroupId: orphanGroup!.id,
        name: "Orphan item",
        price: "1",
        available: true,
      })
      .returning();
    const unlinked = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "X",
        items: [{ productId: productA, quantity: 1, optionItemIds: [orphanItem!.id] }],
      },
    });
    expect(unlinked.statusCode).toBe(400);

    const tableBOnA = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "LOCAL",
        paymentMethod: "PIX",
        customerName: "X",
        tableId: tableB,
        items: [{ productId: productA, quantity: 1 }],
      },
    });
    expect(tableBOnA.statusCode).toBe(403);

    const customerBOnA = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "X",
        customerId: customerB,
        items: [{ productId: productA, quantity: 1 }],
      },
    });
    expect(customerBOnA.statusCode).toBe(403);

    // Valid path still works
    const ok = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "Ok",
        customerId: customerA,
        tableId: tableA,
        items: [
          {
            productId: productA,
            variationId: variationA,
            quantity: 1,
            optionItemIds: [optionItemA],
          },
        ],
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().publicToken).toBeTruthy();
  });

  it("17-20 tracking por public_token isola A e B com mesmo code", async () => {
    const code = "COLLISION1";
    const tokenA = "token-a-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const tokenB = "token-b-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    await db.insert(orders).values([
      {
        establishmentId: EST_A,
        code,
        publicToken: tokenA,
        channel: "CARDAPIO",
        mode: "RETIRADA",
        status: "ENVIADO",
        customerName: "A",
        total: "10",
      },
      {
        establishmentId: EST_B,
        code,
        publicToken: tokenB,
        channel: "CARDAPIO",
        mode: "RETIRADA",
        status: "ENVIADO",
        customerName: "B",
        total: "20",
      },
    ]);

    const trackA = await app.inject({
      method: "GET",
      url: `/api/v1/public/orders/tracking/${tokenA}`,
    });
    expect(trackA.statusCode).toBe(200);
    expect(trackA.json().customer_first_name).toBe("A");
    expect(trackA.json().establishment.slug).toBe("est-a");

    const trackB = await app.inject({
      method: "GET",
      url: `/api/v1/public/orders/tracking/${tokenB}`,
    });
    expect(trackB.statusCode).toBe(200);
    expect(trackB.json().customer_first_name).toBe("B");

    const missing = await app.inject({
      method: "GET",
      url: "/api/v1/public/orders/tracking/does-not-exist",
    });
    expect(missing.statusCode).toBe(404);

    // Deprecated route without slug rejected; with slug isolates
    const deprecatedBare = await app.inject({
      method: "GET",
      url: `/api/v1/public/orders/${code}/tracking`,
    });
    expect(deprecatedBare.statusCode).toBe(410);

    const deprecatedSlug = await app.inject({
      method: "GET",
      url: `/api/v1/public/orders/${code}/tracking?slug=est-b`,
    });
    expect(deprecatedSlug.statusCode).toBe(410);
    expect(deprecatedSlug.json().customer_first_name).toBeUndefined();

    void eq;
  });
});
