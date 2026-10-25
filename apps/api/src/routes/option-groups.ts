import type { AppRole } from "@nexafood/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { requireCurrentEstablishmentRole } from "../lib/tenant-context.js";
import type { OptionGroupService } from "../services/option-group-service.js";

export type OptionGroupsRoutesOpts = {
  optionGroupService: OptionGroupService;
};

const CATALOG_ROLES: AppRole[] = ["ESTABLISHMENT_ADMIN", "MANAGER"];

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  price: z.number(),
  available: z.boolean().optional(),
  position: z.number().int().optional(),
});

const bodySchema = z.object({
  name: z.string().min(1),
  required: z.boolean().optional(),
  minSelect: z.number().int().min(0).optional(),
  maxSelect: z.number().int().min(1).optional(),
  selection: z.enum(["single", "multiple"]).optional(),
  position: z.number().int().optional(),
  active: z.boolean().optional(),
  items: z.array(itemSchema).optional(),
});

const patchSchema = bodySchema.partial();

const optionGroupsRoutes: FastifyPluginAsync<OptionGroupsRoutesOpts> = async (app, opts) => {
  app.get("/api/v1/option-groups", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    return opts.optionGroupService.list(ctx.establishmentId);
  });

  app.get<{ Params: { groupId: string } }>(
    "/api/v1/option-groups/:groupId",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
      return opts.optionGroupService.getById(ctx.establishmentId, request.params.groupId);
    },
  );

  app.post("/api/v1/option-groups", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
    return opts.optionGroupService.create(ctx.establishmentId, parsed.data);
  });

  app.patch<{ Params: { groupId: string } }>(
    "/api/v1/option-groups/:groupId",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
      const parsed = patchSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
      return opts.optionGroupService.update(
        ctx.establishmentId,
        request.params.groupId,
        parsed.data,
      );
    },
  );
};

export default optionGroupsRoutes;
