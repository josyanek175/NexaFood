import burger from "@/assets/burger.jpg";
import combo from "@/assets/combo.jpg";
import porcao from "@/assets/porcao.jpg";
import bebida from "@/assets/bebida.jpg";
import { supabase } from "@/integrations/supabase/client";
import type {
  BusinessHour,
  Category,
  Establishment,
  KitchenSector,
  OptionGroup,
  Product,
} from "@/lib/types";

/**
 * Leitura do cardápio real (Lovable Cloud) mapeada para o modelo de domínio
 * usado pela interface. Todas as consultas filtram por establishment_id.
 */

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
  return Math.round(((h * 60) + 360) % 360);
}

const hhmm = (t: string | null) => (t ? t.slice(0, 5) : "00:00");

export async function fetchEstablishmentBySlug(slug: string): Promise<Establishment | null> {
  const { data, error } = await supabase
    .from("establishments")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;

  const { data: hours } = await supabase
    .from("business_hours")
    .select("weekday, opens, closes, closed")
    .eq("establishment_id", data.id)
    .order("weekday");

  const business_hours: BusinessHour[] = (hours ?? []).map((h) => ({
    weekday: h.weekday,
    opens: hhmm(h.opens),
    closes: hhmm(h.closes),
    closed: h.closed,
  }));

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description ?? "",
    cnpj: data.cnpj ?? "",
    owner: data.legal_name ?? "",
    logo_url: data.logo_url ?? burger,
    cover_url: data.cover_url ?? combo,
    brand_hue: hueFromHex(data.primary_color),
    whatsapp: data.whatsapp ?? data.phone ?? "",
    address: data.address ?? "",
    is_open: data.is_open,
    min_order: Number(data.minimum_order ?? 0),
    delivery_fee_from: 0,
    service_fee_percent: Number(data.service_fee_percentage ?? 0),
    eta_minutes: [data.estimated_time_min, data.estimated_time_max],
    modes: ["delivery", "retirada", "local"],
    delivery_policy: "",
    business_hours,
    plan: "pro",
    status: data.status === "ACTIVE" ? "ativo" : data.status === "TRIAL" ? "trial" : "suspenso",
    created_at: data.created_at,
    due_at: data.created_at,
    users_count: 0,
    orders_count: 0,
  };
}

export async function fetchMenu(establishmentId: string): Promise<{
  categories: Category[];
  products: Product[];
  optionGroups: OptionGroup[];
}> {
  const [cats, prods, sectors, groups, items, variations, links] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("position"),
    supabase.from("products").select("*").eq("establishment_id", establishmentId).order("position"),
    supabase.from("kitchen_sectors").select("id, type").eq("establishment_id", establishmentId),
    supabase
      .from("option_groups")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("position"),
    supabase
      .from("option_items")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("position"),
    supabase
      .from("product_variations")
      .select("*")
      .eq("establishment_id", establishmentId)
      .order("position"),
    supabase
      .from("product_option_groups")
      .select("product_id, option_group_id, position")
      .eq("establishment_id", establishmentId)
      .order("position"),
  ]);

  const sectorById = new Map((sectors.data ?? []).map((s) => [s.id, SECTOR_MAP[s.type] ?? "cozinha"]));

  const categories: Category[] = (cats.data ?? []).map((c) => ({
    id: c.id,
    establishment_id: establishmentId,
    name: c.name,
    position: c.position,
    active: c.active,
    ...(c.available_from ? { available_from: hhmm(c.available_from) } : {}),
    ...(c.available_to ? { available_to: hhmm(c.available_to) } : {}),
  }));

  const optionGroups: OptionGroup[] = (groups.data ?? []).map((g) => ({
    id: g.id,
    establishment_id: establishmentId,
    name: g.name,
    required: g.required,
    min: g.min_select,
    max: g.max_select,
    selection: g.selection === "multiple" ? "multiple" : "single",
    items: (items.data ?? [])
      .filter((i) => i.option_group_id === g.id)
      .map((i) => ({ id: i.id, name: i.name, price: Number(i.price), available: i.available })),
  }));

  const products: Product[] = (prods.data ?? []).map((p) => {
    const sector = (p.sector_id ? sectorById.get(p.sector_id) : undefined) ?? "cozinha";
    return {
      id: p.id,
      establishment_id: establishmentId,
      category_id: p.category_id ?? "",
      name: p.name,
      description: p.description ?? "",
      image_url: p.image_url ?? SECTOR_IMAGE[sector],
      price: Number(p.price),
      ...(p.promo_price != null ? { promo_price: Number(p.promo_price) } : {}),
      sku: p.sku ?? p.id.slice(0, 8).toUpperCase(),
      prep_minutes: p.prep_minutes,
      available: p.available,
      featured: p.featured,
      track_stock: p.track_stock,
      ...(p.stock != null ? { stock: p.stock } : {}),
      sector,
      variations: (variations.data ?? [])
        .filter((v) => v.product_id === p.id)
        .map((v) => ({ id: v.id, name: v.name, price_delta: Number(v.price_delta) })),
      option_group_ids: (links.data ?? [])
        .filter((l) => l.product_id === p.id)
        .map((l) => l.option_group_id),
      removable_ingredients: p.removable_ingredients ?? [],
      channels: (p.channels ?? []) as Product["channels"],
    };
  });

  return { categories, products, optionGroups };
}
