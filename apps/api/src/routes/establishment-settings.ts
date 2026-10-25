import type { AppRole } from "@nexafood/shared";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { badRequest } from "../lib/errors.js";
import { requireCurrentEstablishmentRole } from "../lib/tenant-context.js";
import type { EstablishmentSettingsService } from "../services/establishment-settings-service.js";

export type EstablishmentSettingsRoutesOpts = {
  settingsService: EstablishmentSettingsService;
};

const SETTINGS_ROLES: AppRole[] = ["ESTABLISHMENT_ADMIN", "MANAGER"];

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, "Horário inválido (use HH:MM)");

const hourSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  opens: hhmm,
  closes: hhmm,
  closed: z.boolean(),
});

const optionalText = z.string().max(2000).nullable().optional();

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    legalName: optionalText,
    cnpj: z.string().max(20).nullable().optional(),
    description: optionalText,
    address: z.string().max(500).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    whatsapp: z.string().max(40).nullable().optional(),
    email: z.union([z.string().email().max(160), z.literal(""), z.null()]).optional(),
    logoUrl: z.union([z.string().url().max(500), z.literal(""), z.null()]).optional(),
    isOpen: z.boolean().optional(),
    minimumOrder: z.number().min(0).max(100_000).optional(),
    estimatedTimeMin: z.number().int().min(1).max(240).optional(),
    estimatedTimeMax: z.number().int().min(1).max(480).optional(),
    serviceFeePercentage: z.number().min(0).max(100).optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Cor inválida")
      .optional(),
    businessHours: z.array(hourSchema).max(7).optional(),
  })
  .refine(
    (body) =>
      body.estimatedTimeMin === undefined ||
      body.estimatedTimeMax === undefined ||
      body.estimatedTimeMax >= body.estimatedTimeMin,
    { message: "O tempo máximo precisa ser maior ou igual ao mínimo." },
  );

const establishmentSettingsRoutes: FastifyPluginAsync<EstablishmentSettingsRoutesOpts> = async (
  app,
  opts,
) => {
  app.get("/api/v1/establishment/settings", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, SETTINGS_ROLES);
    return opts.settingsService.get(ctx.establishmentId);
  });

  app.patch("/api/v1/establishment/settings", async (request) => {
    const ctx = requireCurrentEstablishmentRole(request, SETTINGS_ROLES);
    const parsed = patchSchema.safeParse(request.body);
    if (!parsed.success) throw badRequest("Payload inválido.", parsed.error.flatten());

    const data = parsed.data;
    return opts.settingsService.update(ctx.establishmentId, {
      ...data,
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl === "" ? null : data.logoUrl } : {}),
      ...(data.email !== undefined ? { email: data.email === "" ? null : data.email } : {}),
    });
  });
};

export default establishmentSettingsRoutes;
