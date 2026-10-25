import type { AppRole } from "@nexafood/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { requireCurrentEstablishmentRole } from "../lib/tenant-context.js";
import type { CategoryService } from "../services/category-service.js";

export type CategoriesRoutesOpts = {
  categoryService: CategoryService;
};

const CATALOG_ROLES: AppRole[] = ["ESTABLISHMENT_ADMIN", "MANAGER"];

const hhmm = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "Horário inválido (use HH:MM)")
  .nullable()
  .optional();

const bodySchema = z.object({
  name: z.string().min(1),
  position: z.number().int().optional(),
  active: z.boolean().optional(),
  availableFrom: hhmm,
  availableTo: hhmm,
});

const patchSchema = bodySchema.partial();

const categoriesRoutes: FastifyPluginAsync<CategoriesRoutesOpts> = async (app, opts) => {
  app.get("/api/v1/categories", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    return opts.categoryService.list(ctx.establishmentId);
  });

  app.get<{ Params: { categoryId: string } }>(
    "/api/v1/categories/:categoryId",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
      return opts.categoryService.getById(ctx.establishmentId, request.params.categoryId);
    },
  );

  app.post("/api/v1/categories", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
    return opts.categoryService.create(ctx.establishmentId, parsed.data);
  });

  app.patch<{ Params: { categoryId: string } }>(
    "/api/v1/categories/:categoryId",
    async (request) => {
      const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
      const parsed = patchSchema.safeParse(request.body);
      if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());
      return opts.categoryService.update(
        ctx.establishmentId,
        request.params.categoryId,
        parsed.data,
      );
    },
  );
};

export default categoriesRoutes;
