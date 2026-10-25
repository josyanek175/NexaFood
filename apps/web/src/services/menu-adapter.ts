import burger from "@/assets/burger.jpg";
import combo from "@/assets/combo.jpg";
import porcao from "@/assets/porcao.jpg";
import bebida from "@/assets/bebida.jpg";
import type { PublicMenuResponse } from "@nexafood/shared";
import type {
  BusinessHour,
  Category,
  Establishment,
  KitchenSector,
  OptionGroup,
  OrderChannel,
  Product,
} from "@/lib/types";

const SECTOR_MAP: Record<string, KitchenSector> = {
  COZINHA: "cozinha",
  BAR: "bar",
  CHAPA: "chapa",
  PIZZARIA: "pizzaria",
  SOBREMESAS: "sobremesas",
};

const SECTOR_IMAGE: Record<KitchenSector, string> = {
  chapa: burger,
  cozinha: porcao,
  bar: bebida,
  pizzaria: combo,
  sobremesas: combo,
};

function hueFromHex(hex: string | null | undefined): number {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return 24;
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 24;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
}

export type KitchenSectorOption = {
  id: string;
  name: string;
  type: string;
  position: number;
};

export type DomainMenu = {
  establishment: Establishment;
  categories: Category[];
  products: Product[];
  optionGroups: OptionGroup[];
  kitchenSectors: KitchenSectorOption[];
};

/** Converts the public API contract into the UI domain model. */
export function adaptPublicMenuToDomain(menu: PublicMenuResponse): DomainMenu {
  const establishmentId = menu.establishment.id;

  // Defense-in-depth: ignore any row that somehow points to another establishment.
  const sectorById = new Map(
    menu.kitchenSectors.map((s) => [s.id, SECTOR_MAP[s.type] ?? ("cozinha" as KitchenSector)]),
  );

  const business_hours: BusinessHour[] = menu.businessHours.map((h) => ({
    weekday: h.weekday,
    opens: h.opens,
    closes: h.closes,
    closed: h.closed,
  }));

  const establishment: Establishment = {
    id: menu.establishment.id,
    slug: menu.establishment.slug,
    name: menu.establishment.name,
    description: menu.establishment.description ?? "",
    cnpj: "",
    owner: "",
    logo_url: menu.establishment.logoUrl ?? burger,
    cover_url: menu.establishment.coverUrl ?? combo,
    brand_hue: hueFromHex(menu.establishment.primaryColor),
    whatsapp: menu.establishment.whatsapp ?? menu.establishment.phone ?? "",
    address: menu.establishment.address ?? "",
    is_open: menu.establishment.isOpen,
    min_order: menu.establishment.minimumOrder,
    delivery_fee_from: 0,
    service_fee_percent: menu.establishment.serviceFeePercentage,
    eta_minutes: [menu.establishment.estimatedTimeMin, menu.establishment.estimatedTimeMax],
    modes: ["delivery", "retirada", "local"],
    delivery_policy: "",
    business_hours,
    plan: "pro",
    status:
      menu.establishment.status === "ACTIVE"
        ? "ativo"
        : menu.establishment.status === "TRIAL"
          ? "trial"
          : "suspenso",
    created_at: new Date(0).toISOString(),
    due_at: new Date(0).toISOString(),
    users_count: 0,
    orders_count: 0,
  };

  const categories: Category[] = menu.categories.map((c) => ({
    id: c.id,
    establishment_id: establishmentId,
    name: c.name,
    position: c.position,
    active: true,
    ...(c.availableFrom ? { available_from: c.availableFrom } : {}),
    ...(c.availableTo ? { available_to: c.availableTo } : {}),
  }));

  const itemsByGroup = new Map<string, typeof menu.optionItems>();
  for (const item of menu.optionItems) {
    const list = itemsByGroup.get(item.optionGroupId) ?? [];
    list.push(item);
    itemsByGroup.set(item.optionGroupId, list);
  }

  const optionGroups: OptionGroup[] = menu.optionGroups.map((g) => ({
    id: g.id,
    establishment_id: establishmentId,
    name: g.name,
    required: g.required,
    min: g.minSelect,
    max: g.maxSelect,
    selection: g.selection,
    items: (itemsByGroup.get(g.id) ?? []).map((i) => ({
      id: i.id,
      name: i.name,
      price: i.price,
      available: true,
    })),
  }));

  const variationsByProduct = new Map<string, typeof menu.variations>();
  for (const variation of menu.variations) {
    const list = variationsByProduct.get(variation.productId) ?? [];
    list.push(variation);
    variationsByProduct.set(variation.productId, list);
  }

  const products: Product[] = menu.products.map((p) => {
    const sector =
      (p.sectorId ? sectorById.get(p.sectorId) : undefined) ?? ("cozinha" as KitchenSector);
    return {
      id: p.id,
      establishment_id: establishmentId,
      category_id: p.categoryId ?? "",
      name: p.name,
      description: p.description ?? "",
      image_url: p.imageUrl ?? SECTOR_IMAGE[sector],
      price: p.price,
      ...(p.promoPrice != null ? { promo_price: p.promoPrice } : {}),
      sku: p.id.slice(0, 8).toUpperCase(),
      prep_minutes: p.prepMinutes,
      available: p.available,
      featured: p.featured,
      track_stock: false,
      sector,
      variations: (variationsByProduct.get(p.id) ?? []).map((v) => ({
        id: v.id,
        name: v.name,
        price_delta: v.priceDelta,
        available: v.available,
      })),
      option_group_ids: p.optionGroupIds,
      removable_ingredients: p.removableIngredients ?? [],
      channels: (p.channels ?? []) as OrderChannel[],
    };
  });

  const kitchenSectors: KitchenSectorOption[] = [...menu.kitchenSectors]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      position: s.position,
    }));

  return { establishment, categories, products, optionGroups, kitchenSectors };
}
