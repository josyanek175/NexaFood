import { describe, expect, it } from "vitest";
import { __productsTestUtils } from "./products-api";

describe("products-api paths", () => {
  it("monta query string de filtros", () => {
    expect(__productsTestUtils.listPath()).toBe("/api/v1/products");
    expect(
      __productsTestUtils.listPath({
        q: "burger",
        categoryId: "cat-1",
        active: true,
        available: false,
      }),
    ).toBe("/api/v1/products?q=burger&categoryId=cat-1&active=true&available=false");
  });
});
