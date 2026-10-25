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
  orders,
  orderItems,
  optionGroups,
  optionItems,
  productOptionGroups,
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
  it("pedido inválido desfaz pedido, itens e histórico inteiros", async () => {
    const before = (await db.select().from(orders)).length;
    const eventsBefore = (await db.select().from(orderStatusEvents)).length;
    const itemsBefore = (await db.select().from(orderItems)).length;
    const r = await app.inject({ method: "POST", url: "/api/v1/public/orders", payload: {
      slug: "est-a", mode: "RETIRADA", paymentMethod: "PIX", customerName: "Rollback",
      items: [{ productId, quantity: 1 }, { productId: "99999999-9999-4999-8999-999999999999", quantity: 1 }],
    }});
    expect(r.statusCode).toBeGreaterThanOrEqual(400);
    expect((await db.select().from(orders)).length).toBe(before);
    expect((await db.select().from(orderItems)).length).toBe(itemsBefore);
    expect((await db.select().from(orderStatusEvents)).length).toBe(eventsBefore);
  });

  it("não reabre pedido finalizado nem altera seus itens na cozinha", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/public/orders", payload: {
      slug: "est-a", mode: "RETIRADA", paymentMethod: "PIX", customerName: "Terminal",
      items: [{ productId, quantity: 1 }],
    }});
    expect(created.statusCode).toBe(200);
    const id = created.json().orderId;
    const headers = { cookie: adminCookie };
    expect((await app.inject({ method: "PATCH", url: `/api/v1/orders/${id}/status`, headers, payload: { status: "FINALIZADO" } })).statusCode).toBe(200);
    const reopen = await app.inject({ method: "PATCH", url: `/api/v1/orders/${id}/status`, headers, payload: { status: "PREPARANDO" } });
    expect(reopen.statusCode).toBe(400);
    const [item] = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    const kitchen = await app.inject({ method: "PATCH", url: `/api/v1/order-items/${item!.id}/kitchen-status`, headers, payload: { status: "PREPARANDO" } });
    expect(kitchen.statusCode).toBe(400);
  });

  it("bloqueia pedidos públicos quando fechado, preservando operação interna", async () => {
    await db.update(establishments).set({ isOpen: false }).where(eq(establishments.id, EST_A));
    try {
      const payload = { slug: "est-a", mode: "RETIRADA", paymentMethod: "PIX", customerName: "Fechado", items: [{ productId, quantity: 1 }] };
      const publicOrder = await app.inject({ method: "POST", url: "/api/v1/public/orders", payload });
      expect(publicOrder.statusCode).toBe(400);
      const internal = await app.inject({ method: "POST", url: "/api/v1/orders", headers: { cookie: adminCookie }, payload });
      expect(internal.statusCode).toBe(200);
    } finally {
      await db.update(establishments).set({ isOpen: true }).where(eq(establishments.id, EST_A));
    }
  });

  it("nega escrita e SSE autenticado para origem não autorizada", async () => {
    const headers = { cookie: adminCookie, origin: "https://untrusted.example.test" };
    const mutation = await app.inject({ method: "POST", url: "/api/v1/auth/logout", headers });
    expect(mutation.statusCode).toBe(403);
    const stream = await app.inject({ url: "/api/v1/events", headers });
    expect(stream.statusCode).toBe(403);
    expect(stream.headers["access-control-allow-origin"]).not.toBe("https://untrusted.example.test");
    expect((await app.inject({ url: "/api/v1/auth/me", headers: { cookie: adminCookie } })).statusCode).toBe(200);
  });

  it("valida mínimo, dados de entrega e troco no servidor", async () => {
    const payload = { slug: "est-a", mode: "RETIRADA", paymentMethod: "PIX", customerName: "Checkout", items: [{ productId, quantity: 1 }] };
    await db.update(establishments).set({ minimumOrder: "50.00" }).where(eq(establishments.id, EST_A));
    try {
      expect((await app.inject({ method: "POST", url: "/api/v1/public/orders", payload })).statusCode).toBe(400);
    } finally {
      await db.update(establishments).set({ minimumOrder: "0.00" }).where(eq(establishments.id, EST_A));
    }
    for (const patch of [{ mode: "DELIVERY" }, { paymentMethod: "DINHEIRO", changeFor: 1 }]) {
      expect((await app.inject({ method: "POST", url: "/api/v1/public/orders", payload: { ...payload, ...patch } })).statusCode).toBe(400);
    }
  });

  it("valida seleção obrigatória, limite e duplicação de adicionais no servidor", async () => {
    const [group] = await db.insert(optionGroups).values({ establishmentId: EST_A, name: "Ponto", required: true, minSelect: 1, maxSelect: 1, selection: "single" }).returning();
    const opts = await db.insert(optionItems).values([
      { establishmentId: EST_A, optionGroupId: group!.id, name: "Normal", price: "1.00" },
      { establishmentId: EST_A, optionGroupId: group!.id, name: "Bem passado", price: "2.00" },
    ]).returning();
    await db.insert(productOptionGroups).values({ establishmentId: EST_A, productId, optionGroupId: group!.id });
    for (const optionItemIds of [[], [opts[0]!.id, opts[0]!.id], opts.map(o => o.id)]) {
      const r = await app.inject({ method: "POST", url: "/api/v1/public/orders", payload: {
        slug: "est-a", mode: "RETIRADA", paymentMethod: "PIX", customerName: "Adicionais",
        items: [{ productId, quantity: 1, optionItemIds }],
      }});
      expect(r.statusCode).toBe(400);
    }
    const valid = await app.inject({ method: "POST", url: "/api/v1/public/orders", payload: {
      slug: "est-a", mode: "RETIRADA", paymentMethod: "PIX", customerName: "Adicionais",
      items: [{ productId, quantity: 2, optionItemIds: [opts[0]!.id] }],
    }});
    expect(valid.statusCode).toBe(200);
    expect(valid.json().total).toBe(42);
  });

  it("preflight permite PATCH ao navegador autorizado", async () => {
    const r = await app.inject({ method: "OPTIONS", url: "/api/v1/orders/11111111-1111-4111-8111-111111111111/status", headers: {
      origin: "http://localhost:5173", "access-control-request-method": "PATCH", "access-control-request-headers": "content-type",
    }});
    expect(r.statusCode).toBe(204);
    expect(String(r.headers["access-control-allow-methods"])).toContain("PATCH");
    expect(r.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

});
