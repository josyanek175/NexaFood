import { and, asc, eq } from "drizzle-orm";
import type { EstablishmentSettings, PublicBusinessHour } from "@nexafood/shared";
import type { Database } from "../db/client.js";
import { businessHours, establishments } from "../db/schema/index.js";
import { badRequest, notFound } from "../lib/errors.js";

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function money(value: number): string {
  return value.toFixed(2);
}

function hhmm(value: string | null | undefined): string {
  if (!value) return "18:00";
  const match = String(value).match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "18:00";
}

function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

const DEFAULT_HOUR = { opens: "18:00", closes: "23:00", closed: false };

export type BusinessHourInput = {
  weekday: number;
  opens: string;
  closes: string;
  closed: boolean;
};

export type PatchEstablishmentSettingsInput = {
  name?: string | undefined;
  legalName?: string | null | undefined;
  cnpj?: string | null | undefined;
  description?: string | null | undefined;
  address?: string | null | undefined;
  phone?: string | null | undefined;
  whatsapp?: string | null | undefined;
  email?: string | null | undefined;
  logoUrl?: string | null | undefined;
  isOpen?: boolean | undefined;
  minimumOrder?: number | undefined;
  estimatedTimeMin?: number | undefined;
  estimatedTimeMax?: number | undefined;
  serviceFeePercentage?: number | undefined;
  primaryColor?: string | undefined;
  businessHours?: BusinessHourInput[] | undefined;
};

export class EstablishmentSettingsService {
  constructor(private readonly db: Database) {}

  async get(establishmentId: string): Promise<EstablishmentSettings> {
    const row = await this.load(establishmentId);
    const hours = await this.loadHours(establishmentId);
    return this.toDto(row, hours);
  }

  async update(
    establishmentId: string,
    input: PatchEstablishmentSettingsInput,
  ): Promise<EstablishmentSettings> {
    const current = await this.load(establishmentId);
    const patch: Partial<typeof establishments.$inferInsert> = { updatedAt: new Date() };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw badRequest("Informe o nome do estabelecimento.");
      patch.name = name.slice(0, 120);
    }
    if (input.legalName !== undefined) patch.legalName = blankToNull(input.legalName)?.slice(0, 160) ?? null;
    if (input.cnpj !== undefined) patch.cnpj = blankToNull(input.cnpj)?.slice(0, 20) ?? null;
    if (input.description !== undefined) {
      patch.description = blankToNull(input.description)?.slice(0, 2000) ?? null;
    }
    if (input.address !== undefined) patch.address = blankToNull(input.address)?.slice(0, 500) ?? null;
    if (input.phone !== undefined) patch.phone = blankToNull(input.phone)?.slice(0, 40) ?? null;
    if (input.whatsapp !== undefined) patch.whatsapp = blankToNull(input.whatsapp)?.slice(0, 40) ?? null;
    if (input.email !== undefined) patch.email = blankToNull(input.email)?.slice(0, 160) ?? null;
    if (input.logoUrl !== undefined) patch.logoUrl = blankToNull(input.logoUrl);
    if (input.isOpen !== undefined) patch.isOpen = input.isOpen;
    if (input.minimumOrder !== undefined) patch.minimumOrder = money(input.minimumOrder);
    if (input.serviceFeePercentage !== undefined) {
      patch.serviceFeePercentage = money(input.serviceFeePercentage);
    }
    if (input.primaryColor !== undefined) patch.primaryColor = input.primaryColor;

    const etaMin = input.estimatedTimeMin ?? current.estimatedTimeMin;
    const etaMax = input.estimatedTimeMax ?? current.estimatedTimeMax;
    if (etaMax < etaMin) {
      throw badRequest("O tempo máximo precisa ser maior ou igual ao mínimo.");
    }
    if (input.estimatedTimeMin !== undefined) patch.estimatedTimeMin = input.estimatedTimeMin;
    if (input.estimatedTimeMax !== undefined) patch.estimatedTimeMax = input.estimatedTimeMax;

    const [updated] = await this.db
      .update(establishments)
      .set(patch)
      .where(eq(establishments.id, establishmentId))
      .returning();
    if (!updated) throw notFound("Estabelecimento não encontrado.");

    if (input.businessHours) {
      await this.replaceHours(establishmentId, input.businessHours);
    }

    const hours = await this.loadHours(establishmentId);
    return this.toDto(updated, hours);
  }

  private async load(establishmentId: string) {
    const [row] = await this.db
      .select()
      .from(establishments)
      .where(eq(establishments.id, establishmentId))
      .limit(1);
    if (!row || row.status !== "ACTIVE") throw notFound("Estabelecimento não encontrado.");
    return row;
  }

  private async loadHours(establishmentId: string) {
    return this.db
      .select()
      .from(businessHours)
      .where(eq(businessHours.establishmentId, establishmentId))
      .orderBy(asc(businessHours.weekday));
  }

  private async replaceHours(establishmentId: string, hours: BusinessHourInput[]) {
    const seen = new Set<number>();
    for (const hour of hours) {
      if (seen.has(hour.weekday)) throw badRequest("Dia da semana repetido.");
      seen.add(hour.weekday);
    }

    const existing = await this.loadHours(establishmentId);
    const byDay = new Map(existing.map((row) => [row.weekday, row]));

    for (const hour of hours) {
      const opens = hhmm(hour.opens);
      const closes = hhmm(hour.closes);
      const current = byDay.get(hour.weekday);
      if (current) {
        await this.db
          .update(businessHours)
          .set({ opens, closes, closed: hour.closed, updatedAt: new Date() })
          .where(
            and(
              eq(businessHours.id, current.id),
              eq(businessHours.establishmentId, establishmentId),
            ),
          );
      } else {
        await this.db.insert(businessHours).values({
          establishmentId,
          weekday: hour.weekday,
          opens,
          closes,
          closed: hour.closed,
        });
      }
    }
  }

  private toDto(
    row: typeof establishments.$inferSelect,
    hours: Array<typeof businessHours.$inferSelect>,
  ): EstablishmentSettings {
    const byDay = new Map(hours.map((hour) => [hour.weekday, hour]));
    const businessHoursDto: PublicBusinessHour[] = [];
    for (let weekday = 0; weekday <= 6; weekday += 1) {
      const hour = byDay.get(weekday);
      businessHoursDto.push({
        weekday,
        opens: hour ? hhmm(hour.opens) : DEFAULT_HOUR.opens,
        closes: hour ? hhmm(hour.closes) : DEFAULT_HOUR.closes,
        closed: hour ? hour.closed : DEFAULT_HOUR.closed,
      });
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      legalName: row.legalName,
      cnpj: row.cnpj,
      description: row.description,
      address: row.address,
      phone: row.phone,
      whatsapp: row.whatsapp,
      email: row.email,
      logoUrl: row.logoUrl,
      isOpen: row.isOpen,
      minimumOrder: toNumber(row.minimumOrder),
      estimatedTimeMin: row.estimatedTimeMin,
      estimatedTimeMax: row.estimatedTimeMax,
      serviceFeePercentage: toNumber(row.serviceFeePercentage),
      primaryColor: row.primaryColor,
      businessHours: businessHoursDto,
    };
  }
}
