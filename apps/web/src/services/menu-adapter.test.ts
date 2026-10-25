import { describe, expect, it } from "vitest";
import type { PublicMenuResponse } from "@nexafood/shared";
import { adaptPublicMenuToDomain } from "./menu-adapter";

const EST_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EST_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function sampleMenu(establishmentId: string, slug: string, productName: string): PublicMenuResponse {
  return {
    establishment: {
      id: establishmentId,
      slug,
      name: slug,
      description: "desc",
      logoUrl: null,
      coverUrl: null,
      address: null,
      phone: null,
      whatsapp: null,
      isOpen: true,
      minimumOrder: 25,
      estimatedTimeMin: 20,
      estimatedTimeMax: 40,
      serviceFeePercentage: 10,
      primaryColor: "#E2603B",
      secondaryColor: "#1F1B18",
      status: "ACTIVE",
    },
    businessHours: [{ weekday: 0, opens: "18:00", closes: "23:00", closed: false }],
    kitchenSectors: [{ id: `${establishmentId}-sec`, name: "Chapa", type: "CHAPA", position: 0 }],
    categories: [
      {
        id: `${establishmentId}-cat`,
        name: "Burgers",
        position: 0,
        availableFrom: null,
        availableTo: null,
      },
    ],
    products: [
      {
        id: `${establishmentId}-prod`,
        categoryId: `${establishmentId}-cat`,
        sectorId: `${establishmentId}-sec`,
        name: productName,
        description: "",
        imageUrl: null,
        price: 38.9,
        promoPrice: 32.9,
        prepMinutes: 15,
        available: true,
        featured: true,
        removableIngredients: [],
        channels: ["cardapio"],
        position: 0,
        optionGroupIds: [`${establishmentId}-og`],
      },
    ],
    variations: [
      {
        id: `${establishmentId}-var`,
        productId: `${establishmentId}-prod`,
        name: "Individual",
        priceDelta: 0,
        available: true,
        position: 0,
      },
    ],
    optionGroups: [
      {
        id: `${establishmentId}-og`,
        name: "Ponto",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        selection: "single",
        position: 0,
      },
    ],
    optionItems: [
      {
        id: `${establishmentId}-oi`,
        optionGroupId: `${establishmentId}-og`,
        name: "Ao ponto",
        price: 0,
        position: 0,
      },
    ],
  };
}

describe("adaptPublicMenuToDomain", () => {
  it("converte o contrato público para o modelo de domínio da UI", () => {
    const domain = adaptPublicMenuToDomain(sampleMenu(EST_A, "nexa-burger", "Burger A"));
    expect(domain.establishment.slug).toBe("nexa-burger");
    expect(domain.establishment.min_order).toBe(25);
    expect(domain.establishment.service_fee_percent).toBe(10);
    expect(domain.products[0]?.name).toBe("Burger A");
    expect(domain.products[0]?.establishment_id).toBe(EST_A);
    expect(domain.products[0]?.sector).toBe("chapa");
    expect(domain.products[0]?.promo_price).toBe(32.9);
    expect(domain.optionGroups[0]?.items[0]?.name).toBe("Ao ponto");
    expect(domain.categories[0]?.establishment_id).toBe(EST_A);
  });

  it("não mistura produtos de outro estabelecimento no resultado", () => {
    const menuA = sampleMenu(EST_A, "nexa-a", "Burger A");
    const menuB = sampleMenu(EST_B, "nexa-b", "Pizza B");
    const domainA = adaptPublicMenuToDomain(menuA);
    const domainB = adaptPublicMenuToDomain(menuB);

    expect(domainA.products.some((p) => p.name === "Pizza B")).toBe(false);
    expect(domainB.products.some((p) => p.name === "Burger A")).toBe(false);
    expect(domainA.products.every((p) => p.establishment_id === EST_A)).toBe(true);
    expect(domainB.products.every((p) => p.establishment_id === EST_B)).toBe(true);
  });
});
