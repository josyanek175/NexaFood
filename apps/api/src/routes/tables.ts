import type { AppRole } from "@nexafood/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import {
  requireCurrentEstablishment,
  requireCurrentEstablishmentRole,
} from "../lib/tenant-context.js";
import type { TableService, TableStatusValue } from "../services/table-service.js";

export type TablesRoutesOpts = {
  tableService: TableService;
};

const FLOOR_ROLES: AppRole[] = [
  "ESTABLISHMENT_ADMIN",
  "MANAGER",
  "CASHIER",
  "ATTENDANT",
];

const createBodySchema = z.object({
  number: z.number().int().positive(),
  seats: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

const patchBodySchema = createBodySchema.partial();

const statusBodySchema = z.object({
  status: z.enum([
    "LIVRE",
    "OCUPADA",
    "AGUARDANDO_PEDIDO",
    "PREPARANDO",
    "AGUARDANDO_PAGAMENTO",
    "FECHADA",
  ]),
});

const closeBodySchema = z.object({
  force: z.boolean().optional(),
});

const tablesRoutes: FastifyPluginAsync<TablesRoutesOpts> = async (app, opts) => {
  app.get("/api/v1/tables", async (request) => {
    const ctx = requireCurrentEstablishment(request);
    return opts.tableService.list(ctx.establishmentId);
  });

  app.get<{ Params: { tableId: string } }>("/api/v1/tables/:tableId", async (request) => {
    const ctx = requireCurrentEstablishment(request);
    return opts.tableService.getById(ctx.establishmentId, request.params.tableId);
  });

  app.post("/api/v1/tables", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, FLOOR_ROLES);
    const parsed = createBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
    return opts.tableService.create(ctx.establishmentId, parsed.data);
  });

  app.patch<{ Params: { tableId: string } }>("/api/v1/tables/:tableId", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, FLOOR_ROLES);
    const parsed = patchBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
    return opts.tableService.update(ctx.establishmentId, request.params.tableId, parsed.data);
  });

  app.post<{ Params: { tableId: string } }>(
    "/api/v1/tables/:tableId/open",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, FLOOR_ROLES);
      return opts.tableService.open(ctx, request.params.tableId);
    },
  );

  app.post<{ Params: { tableId: string } }>(
    "/api/v1/tables/:tableId/close",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, FLOOR_ROLES);
      const parsed = closeBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
      return opts.tableService.close(ctx, request.params.tableId, parsed.data.force ?? false);
    },
  );

  app.patch<{ Params: { tableId: string } }>(
    "/api/v1/tables/:tableId/status",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, FLOOR_ROLES);
      const parsed = statusBodySchema.safeParse(request.body);
      if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
      return opts.tableService.setStatus(
        ctx,
        request.params.tableId,
        parsed.data.status as TableStatusValue,
      );
    },
  );
};

export default tablesRoutes;
