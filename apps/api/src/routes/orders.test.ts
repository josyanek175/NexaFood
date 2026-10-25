import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import {
  categories,
  establishmentUsers,
  establishments,
  kitchenSectors,
  organizations,
  orderStatusEvents,
  products,
} from "../db/schema/index.js";
import { AuthService } from "../services/auth-service.js";
import { createTestDb } from "../test/pglite.js";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const EST_A = "22222222-2222-4222-8222-222222222222";
const EST_B = "33333333-3333-4333-8333-333333333333";
const PASSWORD = "Dev-Only-Pass-123!";

describe("orders API (pglite)", () => {
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
  let productId: string;
  let adminCookie: string;

  beforeAll(async () => {
    ({ db, client } = await createTestDb());
    const authService = new AuthService(db, env);

    await db.insert(organizations).values([
      { id: ORG_A, name: "Org A", status: "ACTIVE" },
      { id: "11111111-1111-4111-8222-222222222222", name: "Org B", status: "ACTIVE" },
    ]);
    await db.insert(establishments).values([
      {
        id: EST_A,
        organizationId: ORG_A,
        name: "Est A",
        slug: "est-a",
        status: "ACTIVE",
        isOpen: true,
        serviceFeePercentage: "10",
      },
      {
        id: EST_B,
        organizationId: "11111111-1111-4111-8222-222222222222",
        name: "Est B",
        slug: "est-b",
        status: "ACTIVE",
      },
    ]);

    const [sector] = await db
      .insert(kitchenSectors)
      .values({ establishmentId: EST_A, name: "Cozinha", type: "COZINHA", position: 0 })
      .returning();
    const [category] = await db
      .insert(categories)
      .values({ establishmentId: EST_A, name: "Burgers", position: 0, active: true })
      .returning();
    const [product] = await db
      .insert(products)
      .values({
        establishmentId: EST_A,
        categoryId: category!.id,
        sectorId: sector!.id,
        name: "Burger",
        price: "20.00",
        available: true,
        channels: ["cardapio"],
      })
      .returning();
    productId = product!.id;

    const admin = await authService.createUser({
      email: "ops@example.com",
      password: PASSWORD,
      fullName: "Ops Admin",
    });
    await db.insert(establishmentUsers).values({
      establishmentId: EST_A,
      userId: admin.id,
      role: "ESTABLISHMENT_ADMIN",
      active: true,
    });

    app = await buildApp({ env, db, authService });

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "ops@example.com", password: PASSWORD },
    });
    const setCookie = String(login.headers["set-cookie"]);
    adminCookie = `nexa_session=${setCookie.match(/nexa_session=([^;]+)/)?.[1]}`;
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    if (client) await client.close();
  });

  it("place order + tracking token + status history", async () => {
    const placed = await app.inject({
      method: "POST",
      url: "/api/v1/public/orders",
      payload: {
        slug: "est-a",
        mode: "RETIRADA",
        paymentMethod: "PIX",
        customerName: "Cliente Teste",
        items: [{ productId, quantity: 2 }],
      },
    });
    expect(placed.statusCode).toBe(200);
    const body = placed.json();
    expect(body.code).toMatch(/^\d{10}$/);
    expect(body.total).toBe(40);
    expect(body.publicToken).toBeTruthy();

    const tracking = await app.inject({
      method: "GET",
      url: `/api/v1/public/orders/tracking/${body.publicToken}`,
    });
    expect(tracking.statusCode).toBe(200);
    expect(tracking.json().customer_first_name).toBe("Cliente");
    expect(tracking.json().items).toHaveLength(1);

    const events = await db
      .select()
      .from(orderStatusEvents)
      .where(eq(orderStatusEvents.establishmentId, EST_A));
    expect(events.some((e) => e.status === "ENVIADO")).toBe(true);

    const list = await app.inject({
      method: "GET",
      url: `/api/v1/orders`,
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()[0]?.code).toBe(body.code);

    const orderId = list.json()[0].id as string;
    const itemId = list.json()[0].items[0].id as string;
    expect(list.json()[0].items[0].kitchenStatus).toBe("NOVO");

    const startItem = await app.inject({
      method: "PATCH",
      url: `/api/v1/order-items/${itemId}/kitchen-status`,
      headers: { cookie: adminCookie },
      payload: { status: "PREPARANDO" },
    });
    expect(startItem.statusCode).toBe(200);
    expect(startItem.json().orderStatus).toBe("PREPARANDO");

    const finishItem = await app.inject({
      method: "PATCH",
      url: `/api/v1/order-items/${itemId}/kitchen-status`,
      headers: { cookie: adminCookie },
      payload: { status: "PRONTO" },
    });
    expect(finishItem.statusCode).toBe(200);
    expect(finishItem.json().orderStatus).toBe("PRONTO");

    const patched = await app.inject({
      method: "PATCH",
      url: `/api/v1/orders/${orderId}/status`,
      headers: { cookie: adminCookie },
      payload: { status: "FINALIZADO" },
    });
    expect(patched.statusCode).toBe(200);

    const menu = await app.inject({
      method: "GET",
      url: `/api/v1/admin/menu`,
      headers: { cookie: adminCookie },
    });
    expect(menu.statusCode).toBe(200);
    expect(menu.json().products[0]?.name).toBe("Burger");
  });

  it("staff cria pedido manual no balcão", async () => {
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/orders",
      headers: { cookie: adminCookie },
      payload: {
        mode: "LOCAL",
        paymentMethod: "CAIXA",
        channel: "BALCAO",
        customerName: "Cliente Balcão",
        items: [{ productId, quantity: 1 }],
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().code).toBeTruthy();
    expect(created.json().orderId).toBeTruthy();

    const list = await app.inject({
      method: "GET",
      url: "/api/v1/orders",
      headers: { cookie: adminCookie },
    });
    const found = list
      .json()
      .find((o: { id: string }) => o.id === created.json().orderId);
    expect(found?.channel).toBe("BALCAO");
    expect(found?.customerName).toBe("Cliente Balcão");
  });
});
