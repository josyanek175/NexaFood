import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicMenuResponse } from "@nexafood/shared";

const apiGet = vi.fn();

vi.mock("@/lib/api-client", async () => {
  class ApiClientError extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string) {
      super(message);
      this.name = "ApiClientError";
      this.status = status;
      this.code = code;
    }
  }
  return {
    ApiClientError,
    apiClient: {
      get: (...args: unknown[]) => apiGet(...args),
    },
  };
});

import { ApiClientError } from "@/lib/api-client";
import {
  __menuTestUtils,
  getAdminMenuByEstablishmentId,
  getPublicEstablishmentBySlug,
  getPublicMenuBySlug,
} from "./menu";

const EST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function apiPayload(slug: string): PublicMenuResponse {
  return {
    establishment: {
      id: EST_A,
      slug,
      name: "Nexa Burger",
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
    categories: [],
    products: [
      {
        id: `${EST_A}-prod`,
        categoryId: null,
        sectorId: null,
        name: "Burger A",
        description: "",
        imageUrl: null,
        price: 10,
        promoPrice: null,
        prepMinutes: 10,
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

describe("menu service contracts", () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it("getPublicMenuBySlug usa a API pelo slug", async () => {
    apiGet.mockResolvedValue(apiPayload("nexa-burger"));

    const establishment = await getPublicEstablishmentBySlug("nexa-burger");
    expect(establishment?.id).toBe(EST_A);
    expect(apiGet).toHaveBeenCalledWith(__menuTestUtils.publicMenuPath("nexa-burger"));

    apiGet.mockClear();
    apiGet.mockResolvedValue(apiPayload("nexa-burger"));
    const menu = await getPublicMenuBySlug("nexa-burger");
    expect(menu.products[0]?.name).toBe("Burger A");
    expect(apiGet).toHaveBeenCalledWith("/api/v1/public/establishments/nexa-burger/menu");
  });

  it("getPublicMenuBySlug propaga erro da API", async () => {
    apiGet.mockRejectedValue(new ApiClientError("down", 503, "API_DOWN"));
    await expect(getPublicMenuBySlug("nexa-burger")).rejects.toMatchObject({ status: 503 });
  });

  it("getAdminMenuByEstablishmentId usa a API autenticada da sessão", async () => {
    apiGet.mockResolvedValue(apiPayload("nexa-burger"));
    const menu = await getAdminMenuByEstablishmentId(EST_A);
    expect(apiGet).toHaveBeenCalledWith(__menuTestUtils.adminMenuPath());
    expect(menu.products[0]?.name).toBe("Burger A");
  });
});
