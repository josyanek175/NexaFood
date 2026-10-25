import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  categories,
  customers,
  kitchenSectors,
  optionGroups,
  optionItems,
  productOptionGroups,
  productVariations,
  products,
  restaurantTables,
} from "../db/schema/index.js";
import { badRequest, forbidden } from "./errors.js";

/**
 * Ensures a referenced resource belongs to the given establishment.
 * Never trust FK ids from the client without this check.
 */
export async function assertSameTenantCategory(
  db: Database,
  establishmentId: string,
  categoryId: string,
): Promise<void> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw forbidden("Categoria pertence a outro estabelecimento.");
}

export async function assertSameTenantKitchenSector(
  db: Database,
  establishmentId: string,
  sectorId: string,
): Promise<typeof kitchenSectors.$inferSelect> {
  const [row] = await db
    .select()
    .from(kitchenSectors)
    .where(and(eq(kitchenSectors.id, sectorId), eq(kitchenSectors.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw forbidden("Setor pertence a outro estabelecimento.");
  return row;
}

export async function assertSameTenantProduct(
  db: Database,
  establishmentId: string,
  productId: string,
): Promise<typeof products.$inferSelect> {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw forbidden("Produto pertence a outro estabelecimento.");
  return row;
}

export async function assertSameTenantVariation(
  db: Database,
  establishmentId: string,
  productId: string,
  variationId: string,
): Promise<typeof productVariations.$inferSelect> {
  const [row] = await db
    .select()
    .from(productVariations)
    .where(
      and(
        eq(productVariations.id, variationId),
        eq(productVariations.productId, productId),
        eq(productVariations.establishmentId, establishmentId),
      ),
    )
    .limit(1);
  if (!row) throw badRequest("Variação inválida para este produto.");
  return row;
}

export async function assertSameTenantOptionGroup(
  db: Database,
  establishmentId: string,
  optionGroupId: string,
): Promise<typeof optionGroups.$inferSelect> {
  const [row] = await db
    .select()
    .from(optionGroups)
    .where(and(eq(optionGroups.id, optionGroupId), eq(optionGroups.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw forbidden("Grupo de adicionais pertence a outro estabelecimento.");
  return row;
}

export async function assertSameTenantOptionItem(
  db: Database,
  establishmentId: string,
  optionItemId: string,
): Promise<typeof optionItems.$inferSelect> {
  const [row] = await db
    .select()
    .from(optionItems)
    .where(and(eq(optionItems.id, optionItemId), eq(optionItems.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw forbidden("Adicional pertence a outro estabelecimento.");
  return row;
}

/** Option item must exist in tenant AND its group must be linked to the product. */
export async function assertOptionItemLinkedToProduct(
  db: Database,
  establishmentId: string,
  productId: string,
  optionItemId: string,
): Promise<{
  optionItem: typeof optionItems.$inferSelect;
  optionGroup: typeof optionGroups.$inferSelect;
}> {
  const optionItem = await assertSameTenantOptionItem(db, establishmentId, optionItemId);
  const optionGroup = await assertSameTenantOptionGroup(db, establishmentId, optionItem.optionGroupId);

  const [link] = await db
    .select({ id: productOptionGroups.id })
    .from(productOptionGroups)
    .where(
      and(
        eq(productOptionGroups.productId, productId),
        eq(productOptionGroups.optionGroupId, optionGroup.id),
        eq(productOptionGroups.establishmentId, establishmentId),
      ),
    )
    .limit(1);

  if (!link) {
    throw badRequest("Adicional não vinculado a este produto.");
  }

  return { optionItem, optionGroup };
}

export async function assertProductOptionGroupSameTenant(
  db: Database,
  establishmentId: string,
  productId: string,
  optionGroupId: string,
): Promise<void> {
  await assertSameTenantProduct(db, establishmentId, productId);
  await assertSameTenantOptionGroup(db, establishmentId, optionGroupId);
}

export async function assertSameTenantTable(
  db: Database,
  establishmentId: string,
  tableId: string,
): Promise<typeof restaurantTables.$inferSelect> {
  const [row] = await db
    .select()
    .from(restaurantTables)
    .where(
      and(eq(restaurantTables.id, tableId), eq(restaurantTables.establishmentId, establishmentId)),
    )
    .limit(1);
  if (!row) throw forbidden("Mesa pertence a outro estabelecimento.");
  return row;
}

export async function assertSameTenantCustomer(
  db: Database,
  establishmentId: string,
  customerId: string,
): Promise<typeof customers.$inferSelect> {
  const [row] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw forbidden("Cliente pertence a outro estabelecimento.");
  return row;
}
