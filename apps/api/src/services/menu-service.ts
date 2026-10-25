import { and, asc, eq } from "drizzle-orm";
import type { PublicMenuResponse } from "@nexafood/shared";
import type { Database } from "../db/client.js";
import {
  businessHours,
  categories,
  establishments,
  kitchenSectors,
  optionGroups,
  optionItems,
  productOptionGroups,
  products,
  productVariations,
} from "../db/schema/index.js";
import { notFound } from "../lib/errors.js";
import { assertTenantRows } from "../lib/tenant.js";

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value);
}

function hhmm(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

export class MenuService {
  constructor(private readonly db: Database) {}

  async getPublicMenuBySlug(slug: string): Promise<PublicMenuResponse> {
    const [establishment] = await this.db
      .select()
      .from(establishments)
      .where(and(eq(establishments.slug, slug), eq(establishments.status, "ACTIVE")))
      .limit(1);

    if (!establishment) {
      throw notFound("Estabelecimento não encontrado");
    }

    return this.buildMenu(establishment, { publicOnly: true });
  }

  /** Admin menu — includes unavailable products/categories/groups for the establishment. */
  async getAdminMenuByEstablishmentId(establishmentId: string): Promise<PublicMenuResponse> {
    const [establishment] = await this.db
      .select()
      .from(establishments)
      .where(eq(establishments.id, establishmentId))
      .limit(1);

    if (!establishment) {
      throw notFound("Estabelecimento não encontrado");
    }

    return this.buildMenu(establishment, { publicOnly: false });
  }

  private async buildMenu(
    establishment: typeof establishments.$inferSelect,
    opts: { publicOnly: boolean },
  ): Promise<PublicMenuResponse> {
    const establishmentId = establishment.id;

    const [
      hoursRows,
      sectorRows,
      categoryRows,
      productRows,
      variationRows,
      groupRows,
      itemRows,
      linkRows,
    ] = await Promise.all([
      this.db
        .select()
        .from(businessHours)
        .where(eq(businessHours.establishmentId, establishmentId))
        .orderBy(asc(businessHours.weekday)),
      this.db
        .select()
        .from(kitchenSectors)
        .where(
          opts.publicOnly
            ? and(eq(kitchenSectors.establishmentId, establishmentId), eq(kitchenSectors.active, true))
            : eq(kitchenSectors.establishmentId, establishmentId),
        )
        .orderBy(asc(kitchenSectors.position)),
      this.db
        .select()
        .from(categories)
        .where(
          opts.publicOnly
            ? and(eq(categories.establishmentId, establishmentId), eq(categories.active, true))
            : eq(categories.establishmentId, establishmentId),
        )
        .orderBy(asc(categories.position)),
      this.db
        .select()
        .from(products)
        .where(
          opts.publicOnly
            ? // Public: hide inactive; keep unavailable (sold-out) so UI can show them.
              and(eq(products.establishmentId, establishmentId), eq(products.active, true))
            : eq(products.establishmentId, establishmentId),
        )
        .orderBy(asc(products.position)),
      this.db
        .select()
        .from(productVariations)
        .where(eq(productVariations.establishmentId, establishmentId))
        .orderBy(asc(productVariations.position)),
      this.db
        .select()
        .from(optionGroups)
        .where(
          opts.publicOnly
            ? and(eq(optionGroups.establishmentId, establishmentId), eq(optionGroups.active, true))
            : eq(optionGroups.establishmentId, establishmentId),
        )
        .orderBy(asc(optionGroups.position)),
      this.db
        .select()
        .from(optionItems)
        .where(
          opts.publicOnly
            ? and(eq(optionItems.establishmentId, establishmentId), eq(optionItems.available, true))
            : eq(optionItems.establishmentId, establishmentId),
        )
        .orderBy(asc(optionItems.position)),
      this.db
        .select()
        .from(productOptionGroups)
        .where(eq(productOptionGroups.establishmentId, establishmentId))
        .orderBy(asc(productOptionGroups.position)),
    ]);

    assertTenantRows(establishmentId, hoursRows, "businessHours");
    assertTenantRows(establishmentId, sectorRows, "kitchenSectors");
    assertTenantRows(establishmentId, categoryRows, "categories");
    assertTenantRows(establishmentId, productRows, "products");
    assertTenantRows(establishmentId, variationRows, "variations");
    assertTenantRows(establishmentId, groupRows, "optionGroups");
    assertTenantRows(establishmentId, itemRows, "optionItems");
    assertTenantRows(establishmentId, linkRows, "productOptionGroups");

    const productIds = new Set(productRows.map((p) => p.id));
    const groupIds = new Set(groupRows.map((g) => g.id));

    const optionGroupIdsByProduct = new Map<string, string[]>();
    for (const link of linkRows) {
      if (!productIds.has(link.productId) || !groupIds.has(link.optionGroupId)) continue;
      const list = optionGroupIdsByProduct.get(link.productId) ?? [];
      list.push(link.optionGroupId);
      optionGroupIdsByProduct.set(link.productId, list);
    }

    return {
      establishment: {
        id: establishment.id,
        slug: establishment.slug,
        name: establishment.name,
        description: establishment.description,
        logoUrl: establishment.logoUrl,
        coverUrl: establishment.coverUrl,
        address: establishment.address,
        phone: establishment.phone,
        whatsapp: establishment.whatsapp,
        isOpen: establishment.isOpen,
        minimumOrder: toNumber(establishment.minimumOrder),
        estimatedTimeMin: establishment.estimatedTimeMin,
        estimatedTimeMax: establishment.estimatedTimeMax,
        serviceFeePercentage: toNumber(establishment.serviceFeePercentage),
        primaryColor: establishment.primaryColor,
        secondaryColor: establishment.secondaryColor,
        status: establishment.status,
      },
      businessHours: hoursRows.map((h) => ({
        weekday: h.weekday,
        opens: hhmm(h.opens) ?? "00:00",
        closes: hhmm(h.closes) ?? "00:00",
        closed: h.closed,
      })),
      kitchenSectors: sectorRows.map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        position: s.position,
      })),
      categories: categoryRows.map((c) => ({
        id: c.id,
        name: c.name,
        position: c.position,
        availableFrom: hhmm(c.availableFrom),
        availableTo: hhmm(c.availableTo),
      })),
      products: productRows.map((p) => ({
        id: p.id,
        categoryId: p.categoryId,
        sectorId: p.sectorId,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        price: toNumber(p.price),
        promoPrice: p.promoPrice == null ? null : toNumber(p.promoPrice),
        prepMinutes: p.prepMinutes,
        available: p.available,
        featured: p.featured,
        removableIngredients: p.removableIngredients ?? [],
        channels: p.channels ?? [],
        position: p.position,
        optionGroupIds: optionGroupIdsByProduct.get(p.id) ?? [],
      })),
      variations: variationRows
        .filter((v) => productIds.has(v.productId))
        .map((v) => ({
          id: v.id,
          productId: v.productId,
          name: v.name,
          priceDelta: toNumber(v.priceDelta),
          available: v.available,
          position: v.position,
        })),
      optionGroups: groupRows.map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        selection: g.selection === "multiple" ? "multiple" : "single",
        position: g.position,
      })),
      optionItems: itemRows
        .filter((i) => groupIds.has(i.optionGroupId))
        .map((i) => ({
          id: i.id,
          optionGroupId: i.optionGroupId,
          name: i.name,
          price: toNumber(i.price),
          position: i.position,
        })),
    };
  }
}
