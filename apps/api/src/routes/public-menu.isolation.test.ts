import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadEnv } from "../config/env.js";
import { buildApp } from "../app.js";
import {
  categories,
  establishments,
  kitchenSectors,
  optionGroups,
  optionItems,
  organizations,
  productOptionGroups,
  productVariations,
  products,
} from "../db/schema/index.js";
import { createTestDb } from "../test/pglite.js";

const ORG = "11111111-1111-4111-8111-111111111111";
const EST_A = "22222222-2222-4222-8222-222222222222";
const EST_B = "33333333-3333-4333-8333-333333333333";

describe("public menu isolation (pglite)", () => {
  const env = loadEnv({ NODE_ENV: "test", LOG_LEVEL: "silent" });
  let app: Awaited<ReturnType<typeof buildApp>>;
  let client: Awaited<ReturnType<typeof createTestDb>>["client"];

  beforeAll(async () => {
    const testDb = await createTestDb();
    const { db } = testDb;
    client = testDb.client;

    await db.insert(organizations).values({ id: ORG, name: "Org", status: "ACTIVE" });
    await db.insert(establishments).values([
      { id: EST_A, organizationId: ORG, name: "A", slug: "slug-a", status: "ACTIVE", isOpen: true },
      { id: EST_B, organizationId: ORG, name: "B", slug: "slug-b", status: "ACTIVE", isOpen: true },
    ]);

    for (const [estId, label] of [
      [EST_A, "A"],
      [EST_B, "B"],
    ] as const) {
      const [sector] = await db
        .insert(kitchenSectors)
        .values({ establishmentId: estId, name: `Sector ${label}`, type: "COZINHA", active: true })
        .returning();
      const [cat] = await db
        .insert(categories)
        .values({ establishmentId: estId, name: `Cat ${label}`, active: true })
        .returning();
      const [og] = await db
        .insert(optionGroups)
        .values({ establishmentId: estId, name: `Group ${label}`, active: true })
        .returning();
      await db.insert(optionItems).values({
        establishmentId: estId,
        optionGroupId: og!.id,
        name: `Item ${label}`,
        price: "1",
        available: true,
      });
      const [prod] = await db
        .insert(products)
        .values({
          establishmentId: estId,
          categoryId: cat!.id,
          sectorId: sector!.id,
          name: `Product ${label}`,
          price: "10",
          available: true,
          channels: ["cardapio"],
        })
        .returning();
      await db.insert(productVariations).values({
        establishmentId: estId,
        productId: prod!.id,
        name: `Var ${label}`,
        priceDelta: "0",
      });
      await db.insert(productOptionGroups).values({
        establishmentId: estId,
        productId: prod!.id,
        optionGroupId: og!.id,
      });
    }

    app = await buildApp({ env, db });
  }, 60_000);

  afterAll(async () => {
    if (app) await app.close();
    if (client) await client.close();
  });

  it("slug A nunca retorna dados do establishment B", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/public/establishments/slug-a/menu",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.establishment.slug).toBe("slug-a");
    expect(body.products.map((p: { name: string }) => p.name)).toEqual(["Product A"]);
    expect(body.categories.map((c: { name: string }) => c.name)).toEqual(["Cat A"]);
    expect(body.optionGroups.map((g: { name: string }) => g.name)).toEqual(["Group A"]);
    expect(body.variations.map((v: { name: string }) => v.name)).toEqual(["Var A"]);
    expect(body.optionItems.map((i: { name: string }) => i.name)).toEqual(["Item A"]);
  });
});
