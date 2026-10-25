import * as demo from "@/data/demo";
import type { Establishment, Order, Product } from "@/lib/types";
import {
  getAdminMenuByEstablishmentId as loadAdminMenuByEstablishmentId,
  getPublicEstablishmentBySlug as loadPublicEstablishmentBySlug,
  getPublicMenuBySlug as loadPublicMenuBySlug,
} from "@/services/menu";

/**
 * Camada de serviços — interface única de dados.
 * Cardápio e auth: Fastify + PostgreSQL.
 * Cupons/impressoras/etc. ainda usam dados simulados.
 */

const delay = <T>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

export const api = {
  listEstablishments: () => delay(demo.establishments),

  getEstablishmentBySlug: async (slug: string) => {
    return loadPublicEstablishmentBySlug(slug);
  },

  /** Cardápio público — sempre por slug via API. */
  getPublicMenuBySlug: async (slug: string) => {
    return loadPublicMenuBySlug(slug);
  },

  /** Cardápio admin — por establishmentId via API autenticada. */
  getAdminMenuByEstablishmentId: async (establishmentId: string) => {
    return loadAdminMenuByEstablishmentId(establishmentId);
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

export type Menu = Awaited<ReturnType<typeof api.getPublicMenuBySlug>>;
export type { Establishment, Order, Product };

/** Estabelecimento em uso no painel (futuramente vem da sessão do usuário). */
export const ACTIVE_ESTABLISHMENT_ID = demo.establishments[0]!.id;
