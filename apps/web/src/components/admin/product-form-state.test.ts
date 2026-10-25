import { describe, expect, it } from "vitest";
import type { AdminProduct } from "@nexafood/shared";
import {
  emptyProductForm,
  formFromAdminProduct,
  moveVariation,
  toWritePayload,
  validateProductForm,
} from "./product-form-state";

const sampleProduct: AdminProduct = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "X-Burger",
  description: "Clássico",
  imageUrl: "https://example.com/burger.jpg",
  price: 22.5,
  promoPrice: 19.9,
  categoryId: "22222222-2222-4222-8222-222222222222",
  sectorId: "33333333-3333-4333-8333-333333333333",
  active: true,
  available: false,
  featured: true,
  prepMinutes: 12,
  sku: "XB-01",
  position: 1,
  channels: ["cardapio"],
  removableIngredients: [],
  variations: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Duplo",
      priceDelta: 12,
      available: true,
      position: 0,
    },
  ],
  optionGroups: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      name: "Extras",
      required: false,
      minSelect: 0,
      maxSelect: 2,
      selection: "multiple",
      position: 0,
      active: true,
      items: [],
    },
  ],
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

describe("product-form-state", () => {
  it("exige nome e preço", () => {
    const errors = validateProductForm(emptyProductForm());
    expect(errors.name).toBeTruthy();
    expect(errors.price).toBeTruthy();
  });

  it("rejeita preço promocional negativo", () => {
    const form = emptyProductForm();
    form.name = "Burger";
    form.price = "10";
    form.promoPrice = "-1";
    expect(validateProductForm(form).promoPrice).toBeTruthy();
  });

  it("monta payload replace-set sem establishmentId", () => {
    const form = formFromAdminProduct(sampleProduct);
    const payload = toWritePayload(form);
    expect(payload).not.toHaveProperty("establishmentId");
    expect(payload.variations).toEqual([
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Duplo",
        priceDelta: 12,
        available: true,
        position: 0,
      },
    ]);
    expect(payload.optionGroupIds).toEqual(["55555555-5555-4555-8555-555555555555"]);
    expect(payload.active).toBe(true);
    expect(payload.available).toBe(false);
  });

  it("reordena variações", () => {
    const moved = moveVariation(
      [
        { key: "a", name: "A", priceDelta: "0", available: true },
        { key: "b", name: "B", priceDelta: "1", available: true },
      ],
      0,
      1,
    );
    expect(moved.map((v) => v.key)).toEqual(["b", "a"]);
  });
});
