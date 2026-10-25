import { describe, expect, it } from "vitest";
import type { PublicMenuResponse } from "@nexafood/shared";
import { buildApp } from "../app.js";
import { loadEnv } from "../config/env.js";
import { notFound } from "../lib/errors.js";
import type { MenuService } from "../services/menu-service.js";

const EST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function menuFor(establishmentId: string, slug: string, productName: string): PublicMenuResponse {
  return {
    establishment: {
      id: establishmentId,
      slug,
      name: slug,
      description: null,
      logoUrl: null,
      coverUrl: null,
      address: null,
      phone: null,
      whatsapp: null,
      isOpen: true,
      minimumOrder: 0,
      estimatedTimeMin: 20,
      estimatedTimeMax: 40,
      serviceFeePercentage: 0,
      primaryColor: "#E2603B",
      secondaryColor: "#1F1B18",
      status: "ACTIVE",
    },
    businessHours: [],
    kitchenSectors: [],
    categories: [
      {
        id: `${establishmentId}-cat`,
        name: "Cat",
        position: 0,
        availableFrom: null,
        availableTo: null,
      },
    ],
    products: [
      {
        id: `${establishmentId}-prod`,
        categoryId: `${establishmentId}-cat`,
        sectorId: null,
        name: productName,
        description: "",
        imageUrl: null,
        price: 10,
        promoPrice: null,
        prepMinutes: 10,
        available: true,
        featured: false,
        removableIngredients: [],
        channels: ["cardapio"],
        position: 0,
        optionGroupIds: [],
      },
    ],
    variations: [],
    optionGroups: [],
    optionItems: [],
  };
}

describe("GET /api/v1/public/establishments/:slug/menu", () => {
  const env = loadEnv({
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    PORT: "3333",
    HOST: "127.0.0.1",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  });

  const menus = new Map<string, PublicMenuResponse>([
    ["nexa-a", menuFor(EST_A, "nexa-a", "Burger A")],
    ["nexa-b", menuFor(EST_B, "nexa-b", "Pizza B")],
  ]);

  const menuService = {
    getPublicMenuBySlug: async (slug: string) => {
      const menu = menus.get(slug);
      if (!menu) throw notFound("Estabelecimento não encontrado");
      return menu;
    },
  } as unknown as MenuService;

  async function withApp(run: (app: Awaited<ReturnType<typeof buildApp>>) => Promise<void>) {
    const app = await buildApp({
      env,
      pool: { query: async () => ({ rows: [] }) } as unknown as import("pg").Pool,
      menuService,
    });
    try {
      await run(app);
    } finally {
      await app.close();
    }
  }

  it("retorna o cardápio do slug solicitado", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/public/establishments/nexa-a/menu",
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as PublicMenuResponse;
      expect(body.establishment.id).toBe(EST_A);
      expect(body.products.map((p) => p.name)).toEqual(["Burger A"]);
    });
  });

  it("não mistura produtos do estabelecimento B no cardápio do A", async () => {
    await withApp(async (app) => {
      const responseA = await app.inject({
        method: "GET",
        url: "/api/v1/public/establishments/nexa-a/menu",
      });
      const responseB = await app.inject({
        method: "GET",
        url: "/api/v1/public/establishments/nexa-b/menu",
      });

      const menuA = responseA.json() as PublicMenuResponse;
      const menuB = responseB.json() as PublicMenuResponse;

      expect(menuA.establishment.id).toBe(EST_A);
      expect(menuB.establishment.id).toBe(EST_B);
      expect(menuA.products.some((p) => p.name === "Pizza B")).toBe(false);
      expect(menuB.products.some((p) => p.name === "Burger A")).toBe(false);
      expect(menuA.products.every((p) => p.id.startsWith(EST_A))).toBe(true);
      expect(menuB.products.every((p) => p.id.startsWith(EST_B))).toBe(true);
    });
  });

  it("retorna 404 para slug inexistente", async () => {
    await withApp(async (app) => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/public/establishments/nao-existe/menu",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: "NOT_FOUND" },
      });
    });
  });
});
