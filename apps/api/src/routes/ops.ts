import type { AppRole } from "@nexafood/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { establishmentEvents } from "../lib/establishment-events.js";
import { badRequest } from "../lib/errors.js";
import {
  requireCurrentEstablishment,
  requireCurrentEstablishmentRole,
} from "../lib/tenant-context.js";
import type { MenuService } from "../services/menu-service.js";
import type {
  KitchenItemStatusValue,
  OrderService,
  OrderStatusValue,
} from "../services/order-service.js";
import type { TableService } from "../services/table-service.js";

export type OpsRoutesOpts = {
  orderService: OrderService;
  menuService: MenuService;
  tableService: TableService;
};

const OPS_ROLES: AppRole[] = [
  "ESTABLISHMENT_ADMIN",
  "MANAGER",
  "CASHIER",
  "ATTENDANT",
  "KITCHEN",
];

const statusBodySchema = z.object({
  status: z.enum([
    "ENVIADO",
    "CONFIRMADO",
    "PREPARANDO",
    "PRONTO",
    "EM_ENTREGA",
    "FINALIZADO",
    "CANCELADO",
  ]),
});

const kitchenStatusBodySchema = z.object({
  status: z.enum(["NOVO", "PREPARANDO", "PRONTO"]),
});

const opsRoutes: FastifyPluginAsync<OpsRoutesOpts> = async (app, opts) => {
  // Tenant always from session currentEstablishmentId — never from path/body.

  app.get("/api/v1/admin/menu", async (request) => {
    const ctx = requireCurrentEstablishment(request);
    return opts.menuService.getAdminMenuByEstablishmentId(ctx.establishmentId);
  });

  app.get("/api/v1/orders", async (request) => {
    const ctx = requireCurrentEstablishment(request);
    return opts.orderService.listOrders(ctx.establishmentId);
  });

  const staffOrderBodySchema = z.object({
    mode: z.enum(["DELIVERY", "RETIRADA", "LOCAL"]),
    paymentMethod: z.enum(["PIX", "CREDITO", "DEBITO", "DINHEIRO", "CAIXA"]),
    channel: z.enum(["BALCAO", "MESA", "MANUAL", "CARDAPIO"]).optional(),
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

  app.post("/api/v1/orders", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, [
      "ESTABLISHMENT_ADMIN",
      "MANAGER",
      "CASHIER",
      "ATTENDANT",
    ]);
    const parsed = staffOrderBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

    const result = await opts.orderService.placeStaffOrder(ctx, parsed.data);
    if (result.tableId) {
      await opts.tableService.syncFromOrders(ctx.establishmentId, result.tableId);
    }
    return result;
  });

  app.patch<{ Params: { orderId: string } }>("/api/v1/orders/:orderId/status", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, OPS_ROLES);
    const parsed = statusBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

    const result = await opts.orderService.updateOrderStatus(
      ctx,
      request.params.orderId,
      parsed.data.status as OrderStatusValue,
      OPS_ROLES,
    );
    if (result.tableId) {
      await opts.tableService.syncFromOrders(ctx.establishmentId, result.tableId);
    }
    return result;
  });

  app.patch<{ Params: { itemId: string } }>(
    "/api/v1/order-items/:itemId/kitchen-status",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, OPS_ROLES);
      const parsed = kitchenStatusBodySchema.safeParse(request.body);
      if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

      const result = await opts.orderService.updateOrderItemKitchenStatus(
        ctx,
        request.params.itemId,
        parsed.data.status as KitchenItemStatusValue,
        OPS_ROLES,
      );
      if (result.tableId) {
        await opts.tableService.syncFromOrders(ctx.establishmentId, result.tableId);
      }
      return result;
    },
  );

  app.get("/api/v1/customers", async (request) => {
    const ctx = requireCurrentEstablishment(request);
    return opts.orderService.listCustomers(ctx.establishmentId);
  });

  app.get<{ Params: { customerId: string } }>("/api/v1/customers/:customerId", async (request) => {
    const ctx = requireCurrentEstablishment(request);
    const customer = await opts.orderService.getCustomer(
      ctx.establishmentId,
      request.params.customerId,
    );
    return {
      id: customer.id,
      establishmentId: customer.establishmentId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      birthdate: customer.birthdate,
      consent: customer.consent,
      notes: customer.notes,
      ordersCount: customer.ordersCount,
      totalSpent: Number(customer.totalSpent),
      lastOrderAt: (customer.lastOrderAt ?? customer.createdAt).toISOString(),
    };
  });

  app.get("/api/v1/events", async (request, reply) => {
    const ctx = requireCurrentEstablishment(request);
    const establishmentId = ctx.establishmentId;

    reply.hijack();
    const origin = typeof request.headers.origin === "string" ? request.headers.origin : "";
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...(origin
        ? {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            Vary: "Origin",
          }
        : {}),
    });
    reply.raw.write(`event: ready\ndata: ${JSON.stringify({ establishmentId })}\n\n`);

    const unsubscribe = establishmentEvents.subscribe(establishmentId, (event) => {
      reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    const heartbeat = setInterval(() => {
      reply.raw.write(`: ping\n\n`);
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    reply.raw.on("close", cleanup);
    request.raw.on("aborted", cleanup);
    request.raw.on("error", cleanup);
  });
};

export default opsRoutes;
