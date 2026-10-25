/**
 * Development-only seed for the local PostgreSQL.
 * Safe sample data only (orgs, establishments, menu, auth users, tables).
 *
 * Usage: npm run db:seed -w @nexafood/api
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { createDb, createPool } from "./client.js";
import { loadEnv } from "../config/env.js";
import { hashPassword, normalizeEmail } from "../auth/password.js";
import {
  businessHours,
  categories,
  establishmentUsers,
  establishments,
  kitchenSectors,
  optionGroups,
  optionItems,
  organizations,
  productOptionGroups,
  products,
  productVariations,
  restaurantTables,
  users,
} from "./schema/index.js";

dotenv.config({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env"),
});

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "11111111-1111-4111-8222-222222222222";
const EST_A = "22222222-2222-4222-8222-222222222222";
const EST_B = "33333333-3333-4333-8333-333333333333";

const USER_ADMIN = "44444444-4444-4444-8444-444444444444";
const USER_KITCHEN = "55555555-5555-4555-8555-555555555555";

async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (env.NODE_ENV === "production") {
    throw new Error("Refusing to run seed-dev in production");
  }
  if (!env.DEV_SEED_PASSWORD || env.DEV_SEED_PASSWORD.length < 8) {
    throw new Error("DEV_SEED_PASSWORD is required (min 8 chars) to seed auth users");
  }

  const pool = createPool(env);
  const db = createDb(pool);
  const passwordHash = await hashPassword(env.DEV_SEED_PASSWORD, {
    ...(env.PASSWORD_PEPPER ? { pepper: env.PASSWORD_PEPPER } : {}),
  });

  try {
    await db
      .insert(organizations)
      .values([
        {
          id: ORG_A,
          name: "Nexa Alimentos Dev",
          legalName: "Nexa Alimentos LTDA",
          document: "00.000.000/0001-00",
          status: "ACTIVE",
        },
        {
          id: ORG_B,
          name: "Outra Rede Dev",
          legalName: "Outra Rede LTDA",
          document: "00.000.000/0002-00",
          status: "ACTIVE",
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(establishments)
      .values([
        {
          id: EST_A,
          organizationId: ORG_A,
          name: "Nexa Burger",
          slug: "nexa-burger",
          description: "Hamburgueria de desenvolvimento (seed local).",
          address: "Rua das Brasas, 240 — São Paulo/SP",
          phone: "1133334444",
          whatsapp: "5511999998888",
          status: "ACTIVE",
          isOpen: true,
          minimumOrder: "25",
          estimatedTimeMin: 35,
          estimatedTimeMax: 50,
          serviceFeePercentage: "10",
        },
        {
          id: EST_B,
          organizationId: ORG_B,
          name: "Pizzaria Central Dev",
          slug: "pizzaria-central",
          description: "Estabelecimento B para testes de isolamento.",
          status: "ACTIVE",
          isOpen: true,
          minimumOrder: "40",
          estimatedTimeMin: 40,
          estimatedTimeMax: 60,
          serviceFeePercentage: "0",
        },
      ])
      .onConflictDoNothing();

    // Clear menu rows for deterministic re-seed of these two establishments.
    for (const estId of [EST_A, EST_B]) {
      await db.delete(productOptionGroups).where(eq(productOptionGroups.establishmentId, estId));
      await db.delete(productVariations).where(eq(productVariations.establishmentId, estId));
      await db.delete(optionItems).where(eq(optionItems.establishmentId, estId));
      await db.delete(optionGroups).where(eq(optionGroups.establishmentId, estId));
      await db.delete(products).where(eq(products.establishmentId, estId));
      await db.delete(categories).where(eq(categories.establishmentId, estId));
      await db.delete(kitchenSectors).where(eq(kitchenSectors.establishmentId, estId));
      await db.delete(businessHours).where(eq(businessHours.establishmentId, estId));
    }

    await db.insert(businessHours).values([
      { establishmentId: EST_A, weekday: 0, opens: "18:00", closes: "23:00", closed: false },
      { establishmentId: EST_A, weekday: 1, opens: "18:00", closes: "23:00", closed: true },
      { establishmentId: EST_B, weekday: 0, opens: "19:00", closes: "23:00", closed: false },
    ]);

    const [sectorA] = await db
      .insert(kitchenSectors)
      .values({ establishmentId: EST_A, name: "Chapa", type: "CHAPA", position: 0 })
      .returning();
    const [sectorB] = await db
      .insert(kitchenSectors)
      .values({ establishmentId: EST_B, name: "Forno", type: "PIZZARIA", position: 0 })
      .returning();

    const [catA] = await db
      .insert(categories)
      .values({ establishmentId: EST_A, name: "Hambúrgueres", position: 1, active: true })
      .returning();
    const [catB] = await db
      .insert(categories)
      .values({ establishmentId: EST_B, name: "Pizzas", position: 1, active: true })
      .returning();

    const [groupA] = await db
      .insert(optionGroups)
      .values({
        establishmentId: EST_A,
        name: "Ponto da carne",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        selection: "single",
        position: 0,
        active: true,
      })
      .returning();

    await db.insert(optionItems).values([
      {
        establishmentId: EST_A,
        optionGroupId: groupA!.id,
        name: "Ao ponto",
        price: "0",
        available: true,
        position: 0,
      },
      {
        establishmentId: EST_A,
        optionGroupId: groupA!.id,
        name: "Bem passado",
        price: "0",
        available: true,
        position: 1,
      },
    ]);

    const [productA] = await db
      .insert(products)
      .values({
        establishmentId: EST_A,
        categoryId: catA!.id,
        sectorId: sectorA!.id,
        name: "Hambúrguer Artesanal",
        description: "Blend 180g e molho da casa.",
        price: "38.90",
        promoPrice: "32.90",
        featured: true,
        available: true,
        prepMinutes: 18,
        position: 0,
        removableIngredients: ["Alface", "Tomate"],
        channels: ["cardapio", "mesa", "balcao"],
      })
      .returning();

    const [productB] = await db
      .insert(products)
      .values({
        establishmentId: EST_B,
        categoryId: catB!.id,
        sectorId: sectorB!.id,
        name: "Pizza Margherita",
        description: "Produto exclusivo do estabelecimento B.",
        price: "49.90",
        featured: true,
        available: true,
        prepMinutes: 25,
        position: 0,
        channels: ["cardapio"],
      })
      .returning();

    await db.insert(productVariations).values({
      establishmentId: EST_A,
      productId: productA!.id,
      name: "Individual",
      priceDelta: "0",
      position: 0,
    });

    await db.insert(productOptionGroups).values({
      establishmentId: EST_A,
      productId: productA!.id,
      optionGroupId: groupA!.id,
      position: 0,
    });

    await db
      .insert(users)
      .values([
        {
          id: USER_ADMIN,
          email: normalizeEmail("admin@nexa.local"),
          fullName: "Admin Dev",
          passwordHash,
          status: "ACTIVE",
        },
        {
          id: USER_KITCHEN,
          email: normalizeEmail("kitchen@nexa.local"),
          fullName: "Kitchen Dev",
          passwordHash,
          status: "ACTIVE",
        },
      ])
      .onConflictDoNothing();

    // Refresh hashes if users already exist (password comes from DEV_SEED_PASSWORD).
    await db.update(users).set({ passwordHash }).where(eq(users.id, USER_ADMIN));
    await db.update(users).set({ passwordHash }).where(eq(users.id, USER_KITCHEN));

    await db.delete(establishmentUsers).where(eq(establishmentUsers.establishmentId, EST_A));
    await db.insert(establishmentUsers).values([
      {
        establishmentId: EST_A,
        userId: USER_ADMIN,
        role: "ESTABLISHMENT_ADMIN",
        active: true,
      },
      {
        establishmentId: EST_A,
        userId: USER_KITCHEN,
        role: "KITCHEN",
        active: true,
      },
    ]);

    await db
      .insert(restaurantTables)
      .values([
        { establishmentId: EST_A, number: 1, seats: 4, status: "LIVRE", active: true },
        { establishmentId: EST_A, number: 2, seats: 2, status: "LIVRE", active: true },
      ])
      .onConflictDoNothing();

    console.log("Seed de desenvolvimento aplicado:");
    console.log(`- /${"nexa-burger"} → ${productA!.name}`);
    console.log(`- /${"pizzaria-central"} → ${productB!.name}`);
    console.log("- users: admin@nexa.local (ESTABLISHMENT_ADMIN), kitchen@nexa.local (KITCHEN)");
    console.log("- tables: 1, 2 on nexa-burger");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
