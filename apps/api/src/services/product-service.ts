import { and, asc, eq, ilike, inArray, notInArray } from "drizzle-orm";
import type { AdminProduct } from "@nexafood/shared";
import type { Database } from "../db/client.js";
import {
  optionGroups,
  optionItems,
  productOptionGroups,
  productVariations,
  products,
} from "../db/schema/index.js";
import { badRequest, notFound } from "../lib/errors.js";
import {
  assertSameTenantCategory,
  assertSameTenantKitchenSector,
  assertSameTenantOptionGroup,
} from "../lib/same-tenant.js";

/** Drizzle transaction client is API-compatible with Database for our queries. */
type DbClient = Database;

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function money(value: number): string {
  return value.toFixed(2);
}

export type ProductListFilters = {
  q?: string | undefined;
  categoryId?: string | undefined;
  active?: boolean | undefined;
  available?: boolean | undefined;
};

export type ProductVariationInput = {
  id?: string | undefined;
  name: string;
  priceDelta: number;
  available?: boolean | undefined;
  position?: number | undefined;
};

export type UpsertProductInput = {
  name: string;
  description?: string | undefined;
  imageUrl?: string | null | undefined;
  price: number;
  promoPrice?: number | null | undefined;
  categoryId?: string | null | undefined;
  sectorId?: string | null | undefined;
  active?: boolean | undefined;
  available?: boolean | undefined;
  featured?: boolean | undefined;
  prepMinutes?: number | undefined;
  sku?: string | null | undefined;
  position?: number | undefined;
  channels?: string[] | undefined;
  removableIngredients?: string[] | undefined;
  variations?: ProductVariationInput[] | undefined;
  optionGroupIds?: string[] | undefined;
};

export type PatchProductInput = {
  [K in keyof UpsertProductInput]?: UpsertProductInput[K] | undefined;
};

const WRITE_CHANNELS = new Set(["cardapio", "mesa", "balcao", "ifood", "99food"]);

export class ProductService {
  constructor(private readonly db: Database) {}

  async list(establishmentId: string, filters: ProductListFilters = {}): Promise<AdminProduct[]> {
    const conditions = [eq(products.establishmentId, establishmentId)];
    if (filters.q?.trim()) {
      conditions.push(ilike(products.name, `%${filters.q.trim()}%`));
    }
    if (filters.categoryId) {
      conditions.push(eq(products.categoryId, filters.categoryId));
    }
    if (typeof filters.active === "boolean") {
      conditions.push(eq(products.active, filters.active));
    }
    if (typeof filters.available === "boolean") {
      conditions.push(eq(products.available, filters.available));
    }

    const rows = await this.db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.position), asc(products.name));

    return Promise.all(rows.map((row) => this.toAdminDto(establishmentId, row)));
  }

  async getById(establishmentId: string, productId: string): Promise<AdminProduct> {
    const row = await this.loadProduct(establishmentId, productId);
    return this.toAdminDto(establishmentId, row);
  }

  async create(establishmentId: string, input: UpsertProductInput): Promise<AdminProduct> {
    this.validateScalars(input);
    await this.validateRefs(establishmentId, input);

    const created = await this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as DbClient;
      const [row] = await tx
        .insert(products)
        .values({
          establishmentId,
          name: input.name.trim(),
          description: (input.description ?? "").trim(),
          imageUrl: input.imageUrl ?? null,
          price: money(input.price),
          promoPrice: input.promoPrice == null ? null : money(input.promoPrice),
          categoryId: input.categoryId ?? null,
          sectorId: input.sectorId ?? null,
          active: input.active ?? true,
          available: input.available ?? true,
          featured: input.featured ?? false,
          prepMinutes: input.prepMinutes ?? 15,
          sku: input.sku?.trim() || null,
          position: input.position ?? 0,
          channels: this.normalizeChannels(input.channels),
          removableIngredients: input.removableIngredients ?? [],
        })
        .returning();
      if (!row) throw badRequest("Não foi possível criar o produto.");

      await this.replaceVariations(tx, establishmentId, row.id, input.variations ?? []);
      await this.replaceOptionGroupLinks(tx, establishmentId, row.id, input.optionGroupIds ?? []);
      return row;
    });

    return this.toAdminDto(establishmentId, created);
  }

  async update(
    establishmentId: string,
    productId: string,
    input: PatchProductInput,
  ): Promise<AdminProduct> {
    await this.loadProduct(establishmentId, productId);
    if (input.name !== undefined || input.price !== undefined || input.promoPrice !== undefined) {
      this.validateScalars({
        name: input.name ?? "x",
        price: input.price ?? 0,
        promoPrice: input.promoPrice,
      });
    }
    await this.validateRefs(establishmentId, input);

    const updated = await this.db.transaction(async (txRaw) => {
      const tx = txRaw as unknown as DbClient;
      const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.description !== undefined) patch.description = input.description.trim();
      if (input.imageUrl !== undefined) patch.imageUrl = input.imageUrl;
      if (input.price !== undefined) patch.price = money(input.price);
      if (input.promoPrice !== undefined) {
        patch.promoPrice = input.promoPrice == null ? null : money(input.promoPrice);
      }
      if (input.categoryId !== undefined) patch.categoryId = input.categoryId;
      if (input.sectorId !== undefined) patch.sectorId = input.sectorId;
      if (input.active !== undefined) patch.active = input.active;
      if (input.available !== undefined) patch.available = input.available;
      if (input.featured !== undefined) patch.featured = input.featured;
      if (input.prepMinutes !== undefined) patch.prepMinutes = input.prepMinutes;
      if (input.sku !== undefined) patch.sku = input.sku?.trim() || null;
      if (input.position !== undefined) patch.position = input.position;
      if (input.channels !== undefined) patch.channels = this.normalizeChannels(input.channels);
      if (input.removableIngredients !== undefined) {
        patch.removableIngredients = input.removableIngredients;
      }

      const [row] = await tx
        .update(products)
        .set(patch)
        .where(and(eq(products.id, productId), eq(products.establishmentId, establishmentId)))
        .returning();
      if (!row) throw notFound("Produto não encontrado");

      if (input.variations !== undefined) {
        await this.replaceVariations(tx, establishmentId, productId, input.variations);
      }
      if (input.optionGroupIds !== undefined) {
        await this.replaceOptionGroupLinks(tx, establishmentId, productId, input.optionGroupIds);
      }
      return row;
    });

    return this.toAdminDto(establishmentId, updated);
  }

  private validateScalars(input: {
    name: string;
    price: number;
    promoPrice?: number | null | undefined;
  }) {
    if (!input.name?.trim()) throw badRequest("Nome do produto é obrigatório.");
    if (input.price < 0) throw badRequest("Preço inválido.");
    if (input.promoPrice != null && input.promoPrice < 0) {
      throw badRequest("Preço promocional inválido.");
    }
  }

  private async validateRefs(establishmentId: string, input: PatchProductInput) {
    if (input.categoryId) {
      await assertSameTenantCategory(this.db, establishmentId, input.categoryId);
    }
    if (input.sectorId) {
      await assertSameTenantKitchenSector(this.db, establishmentId, input.sectorId);
    }
    if (input.optionGroupIds) {
      for (const groupId of input.optionGroupIds) {
        await assertSameTenantOptionGroup(this.db, establishmentId, groupId);
      }
    }
  }

  private normalizeChannels(channels?: string[]): string[] {
    const list = (channels ?? ["cardapio", "mesa", "balcao"]).map((c) => c.trim().toLowerCase());
    for (const c of list) {
      if (!WRITE_CHANNELS.has(c)) throw badRequest(`Canal inválido: ${c}`);
    }
    return list.length ? list : ["cardapio", "mesa", "balcao"];
  }

  private async loadProduct(establishmentId: string, productId: string) {
    const [row] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.establishmentId, establishmentId)))
      .limit(1);
    if (!row) throw notFound("Produto não encontrado");
    return row;
  }

  private async replaceVariations(
    tx: DbClient,
    establishmentId: string,
    productId: string,
    variations: ProductVariationInput[],
  ) {
    const keepIds: string[] = [];
    let position = 0;
    for (const variation of variations) {
      const name = variation.name.trim();
      if (!name) throw badRequest("Nome da variação é obrigatório.");
      if (variation.priceDelta == null || Number.isNaN(Number(variation.priceDelta))) {
        throw badRequest("priceDelta inválido.");
      }

      if (variation.id) {
        const [updated] = await tx
          .update(productVariations)
          .set({
            name,
            priceDelta: money(variation.priceDelta),
            available: variation.available ?? true,
            position: variation.position ?? position,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(productVariations.id, variation.id),
              eq(productVariations.productId, productId),
              eq(productVariations.establishmentId, establishmentId),
            ),
          )
          .returning();
        if (!updated) throw badRequest("Variação inválida para este produto.");
        keepIds.push(updated.id);
      } else {
        const [created] = await tx
          .insert(productVariations)
          .values({
            establishmentId,
            productId,
            name,
            priceDelta: money(variation.priceDelta),
            available: variation.available ?? true,
            position: variation.position ?? position,
          })
          .returning();
        keepIds.push(created!.id);
      }
      position += 1;
    }

    if (keepIds.length === 0) {
      await tx
        .delete(productVariations)
        .where(
          and(
            eq(productVariations.productId, productId),
            eq(productVariations.establishmentId, establishmentId),
          ),
        );
    } else {
      await tx
        .delete(productVariations)
        .where(
          and(
            eq(productVariations.productId, productId),
            eq(productVariations.establishmentId, establishmentId),
            notInArray(productVariations.id, keepIds),
          ),
        );
    }
  }

  private async replaceOptionGroupLinks(
    tx: DbClient,
    establishmentId: string,
    productId: string,
    optionGroupIds: string[],
  ) {
    // Re-validate inside transaction for safety.
    for (const groupId of optionGroupIds) {
      await assertSameTenantOptionGroup(tx, establishmentId, groupId);
    }

    await tx
      .delete(productOptionGroups)
      .where(
        and(
          eq(productOptionGroups.productId, productId),
          eq(productOptionGroups.establishmentId, establishmentId),
        ),
      );

    if (optionGroupIds.length === 0) return;

    await tx.insert(productOptionGroups).values(
      optionGroupIds.map((optionGroupId, index) => ({
        establishmentId,
        productId,
        optionGroupId,
        position: index,
      })),
    );
  }

  private async toAdminDto(
    establishmentId: string,
    row: typeof products.$inferSelect,
  ): Promise<AdminProduct> {
    const variations = await this.db
      .select()
      .from(productVariations)
      .where(
        and(
          eq(productVariations.productId, row.id),
          eq(productVariations.establishmentId, establishmentId),
        ),
      )
      .orderBy(asc(productVariations.position));

    const links = await this.db
      .select()
      .from(productOptionGroups)
      .where(
        and(
          eq(productOptionGroups.productId, row.id),
          eq(productOptionGroups.establishmentId, establishmentId),
        ),
      )
      .orderBy(asc(productOptionGroups.position));

    const groupIds = links.map((l) => l.optionGroupId);
    const groups =
      groupIds.length === 0
        ? []
        : await this.db
            .select()
            .from(optionGroups)
            .where(
              and(
                inArray(optionGroups.id, groupIds),
                eq(optionGroups.establishmentId, establishmentId),
              ),
            );

    const items =
      groupIds.length === 0
        ? []
        : await this.db
            .select()
            .from(optionItems)
            .where(
              and(
                inArray(optionItems.optionGroupId, groupIds),
                eq(optionItems.establishmentId, establishmentId),
              ),
            )
            .orderBy(asc(optionItems.position));

    const groupById = new Map(groups.map((g) => [g.id, g]));
    const itemsByGroup = new Map<string, typeof items>();
    for (const item of items) {
      const list = itemsByGroup.get(item.optionGroupId) ?? [];
      list.push(item);
      itemsByGroup.set(item.optionGroupId, list);
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      imageUrl: row.imageUrl,
      price: toNumber(row.price),
      promoPrice: row.promoPrice == null ? null : toNumber(row.promoPrice),
      categoryId: row.categoryId,
      sectorId: row.sectorId,
      active: row.active,
      available: row.available,
      featured: row.featured,
      prepMinutes: row.prepMinutes,
      sku: row.sku,
      position: row.position,
      channels: row.channels ?? [],
      removableIngredients: row.removableIngredients ?? [],
      variations: variations.map((v) => ({
        id: v.id,
        name: v.name,
        priceDelta: toNumber(v.priceDelta),
        available: v.available,
        position: v.position,
      })),
      optionGroups: links
        .map((link) => {
          const g = groupById.get(link.optionGroupId);
          if (!g) return null;
          return {
            id: g.id,
            name: g.name,
            required: g.required,
            minSelect: g.minSelect,
            maxSelect: g.maxSelect,
            selection: (g.selection === "multiple" ? "multiple" : "single") as "single" | "multiple",
            position: link.position,
            active: g.active,
            items: (itemsByGroup.get(g.id) ?? []).map((i) => ({
              id: i.id,
              name: i.name,
              price: toNumber(i.price),
              available: i.available,
              position: i.position,
            })),
          };
        })
        .filter((g): g is NonNullable<typeof g> => g != null),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
