import { and, asc, eq, notInArray } from "drizzle-orm";
import type { AdminOptionGroup } from "@nexafood/shared";
import type { Database } from "../db/client.js";
import { optionGroups, optionItems } from "../db/schema/index.js";
import { badRequest, notFound } from "../lib/errors.js";

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function money(value: number): string {
  return value.toFixed(2);
}

type DbClient = Database;

export type OptionItemInput = {
  id?: string | undefined;
  name: string;
  price: number;
  available?: boolean | undefined;
  position?: number | undefined;
};

export type UpsertOptionGroupInput = {
  name: string;
  required?: boolean | undefined;
  minSelect?: number | undefined;
  maxSelect?: number | undefined;
  selection?: "single" | "multiple" | undefined;
  position?: number | undefined;
  active?: boolean | undefined;
  items?: OptionItemInput[] | undefined;
};

export type PatchOptionGroupInput = {
  [K in keyof UpsertOptionGroupInput]?: UpsertOptionGroupInput[K] | undefined;
};

export class OptionGroupService {
  constructor(private readonly db: Database) {}

  async list(establishmentId: string): Promise<AdminOptionGroup[]> {
    const groups = await this.db
      .select()
      .from(optionGroups)
      .where(eq(optionGroups.establishmentId, establishmentId))
      .orderBy(asc(optionGroups.position), asc(optionGroups.name));
    return Promise.all(groups.map((g) => this.toDto(establishmentId, g)));
  }

  async getById(establishmentId: string, groupId: string): Promise<AdminOptionGroup> {
    const row = await this.load(establishmentId, groupId);
    return this.toDto(establishmentId, row);
  }

  async create(establishmentId: string, input: UpsertOptionGroupInput): Promise<AdminOptionGroup> {
    this.validateGroup(input);

    const created = await this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as DbClient;
      const [row] = await tx
        .insert(optionGroups)
        .values({
          establishmentId,
          name: input.name.trim(),
          required: input.required ?? false,
          minSelect: input.minSelect ?? 0,
          maxSelect: input.maxSelect ?? 1,
          selection: input.selection ?? "single",
          position: input.position ?? 0,
          active: input.active ?? true,
        })
        .returning();
      if (!row) throw badRequest("Não foi possível criar o grupo.");

      await this.replaceItems(tx, establishmentId, row.id, input.items ?? []);
      return row;
    });

    return this.toDto(establishmentId, created);
  }

  async update(
    establishmentId: string,
    groupId: string,
    input: PatchOptionGroupInput,
  ): Promise<AdminOptionGroup> {
    const current = await this.load(establishmentId, groupId);
    if (input.name !== undefined && !input.name.trim()) {
      throw badRequest("Nome do grupo é obrigatório.");
    }
    if (input.selection && input.selection !== "single" && input.selection !== "multiple") {
      throw badRequest("Tipo de seleção inválido.");
    }
    if (input.minSelect !== undefined || input.maxSelect !== undefined) {
      const min = input.minSelect ?? current.minSelect;
      const max = input.maxSelect ?? current.maxSelect;
      if (min < 0) throw badRequest("Seleção mínima inválida.");
      if (max < 1) throw badRequest("Seleção máxima inválida.");
      if (min > max) throw badRequest("Mínimo não pode ser maior que o máximo.");
    }

    const updated = await this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as DbClient;
      const patch: Partial<typeof optionGroups.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.required !== undefined) patch.required = input.required;
      if (input.minSelect !== undefined) patch.minSelect = input.minSelect;
      if (input.maxSelect !== undefined) patch.maxSelect = input.maxSelect;
      if (input.selection !== undefined) patch.selection = input.selection;
      if (input.position !== undefined) patch.position = input.position;
      if (input.active !== undefined) patch.active = input.active;

      const [row] = await tx
        .update(optionGroups)
        .set(patch)
        .where(and(eq(optionGroups.id, groupId), eq(optionGroups.establishmentId, establishmentId)))
        .returning();
      if (!row) throw notFound("Grupo de adicionais não encontrado");

      if (input.items !== undefined) {
        await this.replaceItems(tx, establishmentId, groupId, input.items);
      }
      return row;
    });

    return this.toDto(establishmentId, updated);
  }

  private validateGroup(input: {
    name: string;
    minSelect?: number | undefined;
    maxSelect?: number | undefined;
    selection?: "single" | "multiple" | undefined;
    required?: boolean | undefined;
  }) {
    if (!input.name?.trim()) throw badRequest("Nome do grupo é obrigatório.");
    const min = input.minSelect ?? 0;
    const max = input.maxSelect ?? 1;
    if (min < 0) throw badRequest("Seleção mínima inválida.");
    if (max < 1) throw badRequest("Seleção máxima inválida.");
    if (min > max) throw badRequest("Mínimo não pode ser maior que o máximo.");
    if (input.selection && input.selection !== "single" && input.selection !== "multiple") {
      throw badRequest("Tipo de seleção inválido.");
    }
  }

  private async load(establishmentId: string, groupId: string) {
    const [row] = await this.db
      .select()
      .from(optionGroups)
      .where(and(eq(optionGroups.id, groupId), eq(optionGroups.establishmentId, establishmentId)))
      .limit(1);
    if (!row) throw notFound("Grupo de adicionais não encontrado");
    return row;
  }

  private async replaceItems(
    tx: DbClient,
    establishmentId: string,
    groupId: string,
    items: OptionItemInput[],
  ) {
    const keepIds: string[] = [];
    let position = 0;
    for (const item of items) {
      const name = item.name.trim();
      if (!name) throw badRequest("Nome do item é obrigatório.");
      if (item.price == null || Number.isNaN(Number(item.price)) || item.price < 0) {
        throw badRequest("Preço do item inválido.");
      }

      if (item.id) {
        const [updated] = await tx
          .update(optionItems)
          .set({
            name,
            price: money(item.price),
            available: item.available ?? true,
            position: item.position ?? position,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(optionItems.id, item.id),
              eq(optionItems.optionGroupId, groupId),
              eq(optionItems.establishmentId, establishmentId),
            ),
          )
          .returning();
        if (!updated) throw badRequest("Item inválido para este grupo.");
        keepIds.push(updated.id);
      } else {
        const [created] = await tx
          .insert(optionItems)
          .values({
            establishmentId,
            optionGroupId: groupId,
            name,
            price: money(item.price),
            available: item.available ?? true,
            position: item.position ?? position,
          })
          .returning();
        keepIds.push(created!.id);
      }
      position += 1;
    }

    if (keepIds.length === 0) {
      await tx
        .delete(optionItems)
        .where(
          and(
            eq(optionItems.optionGroupId, groupId),
            eq(optionItems.establishmentId, establishmentId),
          ),
        );
    } else {
      await tx
        .delete(optionItems)
        .where(
          and(
            eq(optionItems.optionGroupId, groupId),
            eq(optionItems.establishmentId, establishmentId),
            notInArray(optionItems.id, keepIds),
          ),
        );
    }
  }

  private async toDto(
    establishmentId: string,
    row: typeof optionGroups.$inferSelect,
  ): Promise<AdminOptionGroup> {
    const items = await this.db
      .select()
      .from(optionItems)
      .where(
        and(
          eq(optionItems.optionGroupId, row.id),
          eq(optionItems.establishmentId, establishmentId),
        ),
      )
      .orderBy(asc(optionItems.position));

    return {
      id: row.id,
      name: row.name,
      required: row.required,
      minSelect: row.minSelect,
      maxSelect: row.maxSelect,
      selection: row.selection === "multiple" ? "multiple" : "single",
      position: row.position,
      active: row.active,
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        price: toNumber(i.price),
        available: i.available,
        position: i.position,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
