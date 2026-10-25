import type { AppRole } from "@nexafood/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { requireCurrentEstablishmentRole } from "../lib/tenant-context.js";
import type { ProductService } from "../services/product-service.js";

export type ProductsRoutesOpts = {
  productService: ProductService;
};

const CATALOG_ROLES: AppRole[] = ["ESTABLISHMENT_ADMIN", "MANAGER"];

const variationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  priceDelta: z.number(),
  available: z.boolean().optional(),
  position: z.number().int().optional(),
});

const productBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  price: z.number(),
  promoPrice: z.number().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  sectorId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  available: z.boolean().optional(),
  featured: z.boolean().optional(),
  prepMinutes: z.number().int().min(0).optional(),
  sku: z.string().nullable().optional(),
  position: z.number().int().optional(),
  channels: z.array(z.string()).optional(),
  removableIngredients: z.array(z.string()).optional(),
  variations: z.array(variationSchema).optional(),
  optionGroupIds: z.array(z.string().uuid()).optional(),
});

const patchBodySchema = productBodySchema.partial();

function parseBoolQuery(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === "true" || value === true) return true;
  if (value === "false" || value === false) return false;
  return undefined;
}

const productsRoutes: FastifyPluginAsync<ProductsRoutesOpts> = async (app, opts) => {
  // Tenant always from session currentEstablishmentId — never from path/body.

  app.get("/api/v1/products", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    const query = request.query as Record<string, unknown>;
    const active = parseBoolQuery(query.active);
    const available = parseBoolQuery(query.available);
    return opts.productService.list(ctx.establishmentId, {
      q: typeof query.q === "string" ? query.q : undefined,
      categoryId: typeof query.categoryId === "string" ? query.categoryId : undefined,
      ...(active !== undefined ? { active } : {}),
      ...(available !== undefined ? { available } : {}),
    });
  });

  app.get<{ Params: { productId: string } }>("/api/v1/products/:productId", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    return opts.productService.getById(ctx.establishmentId, request.params.productId);
  });

  app.post("/api/v1/products", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    const parsed = productBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

    const data = parsed.data;
    return opts.productService.create(ctx.establishmentId, {
      ...data,
      imageUrl: data.imageUrl === "" ? null : data.imageUrl,
    });
  });

  app.patch<{ Params: { productId: string } }>("/api/v1/products/:productId", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, CATALOG_ROLES);
    const parsed = patchBodySchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

    const data = parsed.data;
    return opts.productService.update(ctx.establishmentId, request.params.productId, {
      ...data,
      ...(data.imageUrl !== undefined
        ? { imageUrl: data.imageUrl === "" ? null : data.imageUrl }
        : {}),
    });
  });
};

export default productsRoutes;
