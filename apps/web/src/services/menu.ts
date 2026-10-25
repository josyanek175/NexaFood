import type { PublicMenuResponse } from "@nexafood/shared";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { Category, Establishment, OptionGroup, Product } from "@/lib/types";
import {
  adaptPublicMenuToDomain,
  type DomainMenu,
  type KitchenSectorOption,
} from "@/services/menu-adapter";

export type MenuData = {
  categories: Category[];
  products: Product[];
  optionGroups: OptionGroup[];
  kitchenSectors: KitchenSectorOption[];
};

function publicMenuPath(slug: string): string {
  return `/api/v1/public/establishments/${encodeURIComponent(slug)}/menu`;
}

function adminMenuPath(): string {
  return `/api/v1/admin/menu`;
}

async function fetchMenuFromApi(path: string, expectedSlug?: string): Promise<DomainMenu> {
  const payload = await apiClient.get<PublicMenuResponse>(path);
  if (expectedSlug && payload.establishment.slug !== expectedSlug) {
    throw new ApiClientError(
      "A API retornou um estabelecimento diferente do solicitado.",
      500,
      "TENANT_MISMATCH",
    );
  }
  return adaptPublicMenuToDomain(payload);
}

/** Public establishment lookup by slug via Fastify API. */
export async function getPublicEstablishmentBySlug(slug: string): Promise<Establishment | null> {
  try {
    const menu = await fetchMenuFromApi(publicMenuPath(slug), slug);
    return menu.establishment;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) return null;
    throw error;
  }
}

/** Public menu by slug (cardápio digital / QR). */
export async function getPublicMenuBySlug(slug: string): Promise<MenuData> {
  const menu = await fetchMenuFromApi(publicMenuPath(slug), slug);
  return {
    categories: menu.categories,
    products: menu.products,
    optionGroups: menu.optionGroups,
    kitchenSectors: menu.kitchenSectors,
  };
}

/** Admin menu for the session's current establishment (authenticated cookie). */
export async function getAdminMenuByEstablishmentId(_establishmentId?: string): Promise<MenuData> {
  const menu = await fetchMenuFromApi(adminMenuPath());
  return {
    categories: menu.categories,
    products: menu.products,
    optionGroups: menu.optionGroups,
    kitchenSectors: menu.kitchenSectors,
  };
}

/** Test helper: exposes path builders without hitting the network. */
export const __menuTestUtils = { publicMenuPath, adminMenuPath };
