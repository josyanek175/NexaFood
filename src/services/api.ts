import * as demo from "@/data/demo";
import { fetchEstablishmentBySlug, fetchMenu } from "@/services/supabase-menu";
import type { Category, Establishment, OptionGroup, Order, Product } from "@/lib/types";

/**
 * Camada de serviços — interface única de dados.
 * Cardápio e estabelecimentos já vêm do Lovable Cloud (sempre filtrados por
 * establishment_id). Os demais módulos ainda usam dados simulados.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

export const api = {
  listEstablishments: () => delay(demo.establishments),

  getEstablishmentBySlug: async (slug: string) =>
    (await fetchEstablishmentBySlug(slug)) ?? demo.establishments.find((e) => e.slug === slug) ?? null,

  getMenu: async (establishmentId: string) => {
    const menu = await fetchMenu(establishmentId);
    if (menu.products.length > 0 || menu.categories.length > 0) return menu;
    const categories = demo.categories.filter((c) => c.establishment_id === establishmentId);
    const products = demo.products.filter((p) => p.establishment_id === establishmentId);
    const optionGroups = demo.optionGroups.filter((g) => g.establishment_id === establishmentId);
    return { categories, products, optionGroups } as {
      categories: Category[];
      products: Product[];
      optionGroups: OptionGroup[];
    };
  },


  listOrders: (establishmentId: string) =>
    delay(demo.orders.filter((o) => o.establishment_id === establishmentId)),

  getOrderByCode: (code: string) =>
    delay(demo.orders.find((o) => o.code.replace("#", "") === code.replace("#", "")) ?? null),

  listTables: (establishmentId: string) =>
    delay(demo.tables.filter((t) => t.establishment_id === establishmentId)),

  listCustomers: (establishmentId: string) =>
    delay(demo.customers.filter((c) => c.establishment_id === establishmentId)),

  listCoupons: (establishmentId: string) =>
    delay(demo.coupons.filter((c) => c.establishment_id === establishmentId)),

  listIntegrations: (establishmentId: string) =>
    delay(demo.integrations.filter((i) => i.establishment_id === establishmentId)),

  listPrinters: (establishmentId: string) =>
    delay(demo.printers.filter((p) => p.establishment_id === establishmentId)),

  listDrivers: (establishmentId: string) =>
    delay(demo.drivers.filter((d) => d.establishment_id === establishmentId)),

  analytics: (_establishmentId: string) =>
    delay({
      salesByHour: demo.salesByHour,
      salesByChannel: demo.salesByChannel,
      topProducts: demo.topProducts,
      paymentsBreakdown: demo.paymentsBreakdown,
    }),
};

export type Menu = Awaited<ReturnType<typeof api.getMenu>>;
export type { Establishment, Order, Product };

/** Estabelecimento em uso no painel (futuramente vem da sessão do usuário). */
export const CURRENT_ESTABLISHMENT_SLUG = "nexa-burger";
