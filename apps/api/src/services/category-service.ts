import { and, asc, eq } from "drizzle-orm";
import type { AdminCategory } from "@nexafood/shared";
import type { Database } from "../db/client.js";
import { categories } from "../db/schema/index.js";
import { badRequest, notFound } from "../lib/errors.js";

function hhmm(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = String(value).match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

export type UpsertCategoryInput = {
  name: string;
  position?: number | undefined;
  active?: boolean | undefined;
  availableFrom?: string | null | undefined;
  availableTo?: string | null | undefined;
};

export type PatchCategoryInput = {
  [K in keyof UpsertCategoryInput]?: UpsertCategoryInput[K] | undefined;
};

export class CategoryService {
  constructor(private readonly db: Database) {}

  async list(establishmentId: string): Promise<AdminCategory[]> {
    const rows = await this.db
      .select()
      .from(categories)
      .where(eq(categories.establishmentId, establishmentId))
      .orderBy(asc(categories.position), asc(categories.name));
    return rows.map((row) => this.toDto(row));
  }

  async getById(establishmentId: string, categoryId: string): Promise<AdminCategory> {
    const row = await this.load(establishmentId, categoryId);
    return this.toDto(row);
  }

  async create(establishmentId: string, input: UpsertCategoryInput): Promise<AdminCategory> {
    const name = input.name.trim();
    if (!name) throw badRequest("Nome da categoria é obrigatório.");

    const [row] = await this.db
      .insert(categories)
      .values({
        establishmentId,
        name,
        position: input.position ?? 0,
        active: input.active ?? true,
        availableFrom: hhmm(input.availableFrom ?? null),
        availableTo: hhmm(input.availableTo ?? null),
      })
      .returning();
    if (!row) throw badRequest("Não foi possível criar a categoria.");
    return this.toDto(row);
  }

  async update(
    establishmentId: string,
    categoryId: string,
    input: PatchCategoryInput,
  ): Promise<AdminCategory> {
    await this.load(establishmentId, categoryId);

    const patch: Partial<typeof categories.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw badRequest("Nome da categoria é obrigatório.");
      patch.name = name;
    }
    if (input.position !== undefined) patch.position = input.position;
    if (input.active !== undefined) patch.active = input.active;
    if (input.availableFrom !== undefined) patch.availableFrom = hhmm(input.availableFrom);
    if (input.availableTo !== undefined) patch.availableTo = hhmm(input.availableTo);

    const [row] = await this.db
      .update(categories)
      .set(patch)
      .where(and(eq(categories.id, categoryId), eq(categories.establishmentId, establishmentId)))
      .returning();
    if (!row) throw notFound("Categoria não encontrada");
    return this.toDto(row);
  }

  private async load(establishmentId: string, categoryId: string) {
    const [row] = await this.db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.establishmentId, establishmentId)))
      .limit(1);
    if (!row) throw notFound("Categoria não encontrada");
    return row;
  }

  private toDto(row: typeof categories.$inferSelect): AdminCategory {
    return {
      id: row.id,
      name: row.name,
      position: row.position,
      active: row.active,
      availableFrom: hhmm(row.availableFrom),
      availableTo: hhmm(row.availableTo),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
