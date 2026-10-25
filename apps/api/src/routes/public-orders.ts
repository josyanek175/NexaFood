import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest, notFound } from "../lib/errors.js";
import type { OrderService } from "../services/order-service.js";

export type PublicOrdersRoutesOpts = {
  orderService: OrderService;
};

const placeOrderBodySchema = z.object({
  slug: z.string().min(3).max(60),
  mode: z.enum(["DELIVERY", "RETIRADA", "LOCAL"]),
  paymentMethod: z.enum(["PIX", "CREDITO", "DEBITO", "DINHEIRO", "CAIXA"]),
  customerName: z.string().min(1).max(80),
  customerPhone: z.string().max(40).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  tableNumber: z.number().int().positive().optional().nullable(),
  tableId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  changeFor: z.number().nonnegative().optional().nullable(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variationId: z.string().uuid().optional().nullable(),
        quantity: z.number().int().min(1).max(99),
        notes: z.string().max(300).optional().nullable(),
        removed: z.array(z.string()).optional(),
        optionItemIds: z.array(z.string().uuid()).optional(),
      }),
    )
    .min(1),
});

const publicOrdersRoutes: FastifyPluginAsync<PublicOrdersRoutesOpts> = async (app, opts) => {
  app.post("/api/v1/public/orders", async (request) => {
    const parsed = placeOrderBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
    return opts.orderService.placeOrder(parsed.data);
  });

  /** Primary public tracking — opaque public_token (not enumerable by code). */
  app.get<{ Params: { token: string } }>(
    "/api/v1/public/orders/tracking/:token",
    async (request) => {
      const tracking = await opts.orderService.getOrderTrackingByPublicToken(request.params.token);
      if (!tracking) throw notFound("Pedido não encontrado");
      return tracking;
    },
  );

  /**
   * Deprecated: requires slug query to avoid cross-tenant code collision.
   * Prefer GET /api/v1/public/orders/tracking/:token
   */
  app.get<{ Params: { code: string }; Querystring: { slug?: string } }>(
    "/api/v1/public/orders/:code/tracking",
    async (request) => {
      const slug = request.query.slug?.trim();
      if (!slug) {
        throw badRequest("Parâmetro slug é obrigatório nesta rota (deprecated). Use /tracking/:token.");
      }
      const tracking = await opts.orderService.getOrderTrackingBySlugAndCode(
        slug,
        request.params.code,
      );
      if (!tracking) throw notFound("Pedido não encontrado");
      return tracking;
    },
  );
};

export default publicOrdersRoutes;
