import type { AdminProduct } from "@nexafood/shared";
import type { ProductWritePayload } from "@/services/products-api";

export type VariationDraft = {
  key: string;
  id?: string | undefined;
  name: string;
  priceDelta: string;
  available: boolean;
};

export type ProductFormState = {
  name: string;
  description: string;
  imageUrl: string;
  price: string;
  promoPrice: string;
  categoryId: string;
  sectorId: string;
  sku: string;
  prepMinutes: string;
  featured: boolean;
  active: boolean;
  available: boolean;
  variations: VariationDraft[];
  optionGroupIds: string[];
};

export type ProductFormErrors = Partial<
  Record<"name" | "price" | "promoPrice" | "prepMinutes" | "imageUrl" | "variations", string>
>;

let keySeq = 0;
export function nextVariationKey(): string {
  keySeq += 1;
  return `var-${keySeq}`;
}

export function emptyProductForm(): ProductFormState {
  return {
    name: "",
    description: "",
    imageUrl: "",
    price: "",
    promoPrice: "",
    categoryId: "",
    sectorId: "",
    sku: "",
    prepMinutes: "15",
    featured: false,
    active: true,
    available: true,
    variations: [],
    optionGroupIds: [],
  };
}

export function formFromAdminProduct(product: AdminProduct): ProductFormState {
  return {
    name: product.name,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    price: String(product.price),
    promoPrice: product.promoPrice == null ? "" : String(product.promoPrice),
    categoryId: product.categoryId ?? "",
    sectorId: product.sectorId ?? "",
    sku: product.sku ?? "",
    prepMinutes: String(product.prepMinutes ?? 15),
    featured: product.featured,
    active: product.active,
    available: product.available,
    variations: [...product.variations]
      .sort((a, b) => a.position - b.position)
      .map((v) => ({
        key: v.id,
        id: v.id,
        name: v.name,
        priceDelta: String(v.priceDelta),
        available: v.available,
      })),
    optionGroupIds: product.optionGroups
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((g) => g.id),
  };
}

export function snapshotForm(state: ProductFormState): string {
  return JSON.stringify(state);
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function validateProductForm(state: ProductFormState): ProductFormErrors {
  const errors: ProductFormErrors = {};
  if (!state.name.trim()) errors.name = "Informe o nome do produto.";

  const price = parseMoney(state.price);
  if (price == null) errors.price = "Informe o preço.";
  else if (price < 0) errors.price = "O preço não pode ser negativo.";

  if (state.promoPrice.trim() !== "") {
    const promo = parseMoney(state.promoPrice);
    if (promo == null) errors.promoPrice = "Preço promocional inválido.";
    else if (promo < 0) errors.promoPrice = "O preço promocional não pode ser negativo.";
  }

  const prep = Number(state.prepMinutes);
  if (!Number.isInteger(prep) || prep < 0) {
    errors.prepMinutes = "Tempo de preparo inválido.";
  }

  if (state.imageUrl.trim() !== "") {
    try {
      const url = new URL(state.imageUrl.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        errors.imageUrl = "Use uma URL http(s) válida.";
      }
    } catch {
      errors.imageUrl = "Use uma URL de imagem válida.";
    }
  }

  for (const v of state.variations) {
    if (!v.name.trim()) {
      errors.variations = "Todas as variações precisam de nome.";
      break;
    }
    const delta = parseMoney(v.priceDelta);
    if (delta == null) {
      errors.variations = "Acréscimo/desconto da variação é inválido.";
      break;
    }
  }

  return errors;
}

export function toWritePayload(state: ProductFormState): ProductWritePayload {
  const price = parseMoney(state.price) ?? 0;
  const promoRaw = state.promoPrice.trim();
  const promo = promoRaw === "" ? null : parseMoney(promoRaw);

  return {
    name: state.name.trim(),
    description: state.description.trim(),
    imageUrl: state.imageUrl.trim() === "" ? null : state.imageUrl.trim(),
    price,
    promoPrice: promo,
    categoryId: state.categoryId || null,
    sectorId: state.sectorId || null,
    sku: state.sku.trim() === "" ? null : state.sku.trim(),
    prepMinutes: Number(state.prepMinutes) || 0,
    featured: state.featured,
    active: state.active,
    available: state.available,
    variations: state.variations.map((v, index) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name.trim(),
      priceDelta: parseMoney(v.priceDelta) ?? 0,
      available: v.available,
      position: index,
    })),
    optionGroupIds: [...state.optionGroupIds],
  };
}

export function moveVariation(
  variations: VariationDraft[],
  index: number,
  direction: -1 | 1,
): VariationDraft[] {
  const target = index + direction;
  if (target < 0 || target >= variations.length) return variations;
  const next = [...variations];
  const a = next[index]!;
  const b = next[target]!;
  next[index] = b;
  next[target] = a;
  return next;
}
