import type { AdminProduct } from "@nexafood/shared";
import { apiClient } from "@/lib/api-client";

export type ProductListFilters = {
  q?: string | undefined;
  categoryId?: string | undefined;
  active?: boolean | undefined;
  available?: boolean | undefined;
};

export type ProductVariationWrite = {
  id?: string | undefined;
  name: string;
  priceDelta: number;
  available?: boolean | undefined;
  position?: number | undefined;
};

export type ProductWritePayload = {
  name: string;
  description?: string | undefined;
  imageUrl?: string | null | undefined;
  price: number;
  promoPrice?: number | null | undefined;
  categoryId?: string | null | undefined;
  sectorId?: string | null | undefined;
  active?: boolean | undefined;
  available?: boolean | undefined;
  featured?: boolean | undefined;
  prepMinutes?: number | undefined;
  sku?: string | null | undefined;
  position?: number | undefined;
  channels?: string[] | undefined;
  removableIngredients?: string[] | undefined;
  variations?: ProductVariationWrite[] | undefined;
  optionGroupIds?: string[] | undefined;
};

function listPath(filters: ProductListFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (typeof filters.active === "boolean") params.set("active", String(filters.active));
  if (typeof filters.available === "boolean") params.set("available", String(filters.available));
  const qs = params.toString();
  return qs ? `/api/v1/products?${qs}` : "/api/v1/products";
}

export async function listProducts(filters: ProductListFilters = {}): Promise<AdminProduct[]> {
  return apiClient.get<AdminProduct[]>(listPath(filters));
}

export async function getProduct(productId: string): Promise<AdminProduct> {
  return apiClient.get<AdminProduct>(`/api/v1/products/${encodeURIComponent(productId)}`);
}

export async function createProduct(payload: ProductWritePayload): Promise<AdminProduct> {
  return apiClient.post<AdminProduct>("/api/v1/products", payload);
}

export async function updateProduct(
  productId: string,
  payload: ProductWritePayload,
): Promise<AdminProduct> {
  return apiClient.patch<AdminProduct>(
    `/api/v1/products/${encodeURIComponent(productId)}`,
    payload,
  );
}

/** Test helper — path builders without network. */
export const __productsTestUtils = { listPath };
