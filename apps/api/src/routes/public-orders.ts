import rateLimit from "@fastify/rate-limit";
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
        removed: z.array(z.string().max(100)).max(50).optional(),
        optionItemIds: z.array(z.string().uuid()).max(50).optional(),
      }),
    )
    .min(1).max(100),
});

const publicOrdersRoutes: FastifyPluginAsync<PublicOrdersRoutesOpts> = async (app, opts) => {
  await app.register(rateLimit, { max: 120, timeWindow: 60_000 });
  app.post("/api/v1/public/orders", { config: { rateLimit: { max: 20, timeWindow: 60_000 } } }, async (request) => {
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

  // Slug + short numeric code is enumerable; the current web uses opaque tokens.
  app.get("/api/v1/public/orders/:code/tracking", async (_request, reply) => {
    return reply.status(410).send({ error: { code: "TRACKING_TOKEN_REQUIRED", message: "Use o link privado de acompanhamento recebido ao criar o pedido." } });
  });
};

export default publicOrdersRoutes;
