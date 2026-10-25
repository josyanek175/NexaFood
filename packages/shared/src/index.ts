/** Shared contracts between API and future web client. */

export type EntityStatus = "ACTIVE" | "SUSPENDED" | "TRIAL" | "INACTIVE";

export type KitchenSectorType = "COZINHA" | "BAR" | "CHAPA" | "PIZZARIA" | "SOBREMESAS";

export type AppRole =
  | "PLATFORM_ADMIN"
  | "ESTABLISHMENT_ADMIN"
  | "MANAGER"
  | "CASHIER"
  | "ATTENDANT"
  | "KITCHEN"
  | "DELIVERY_DRIVER";

export interface PublicEstablishment {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  isOpen: boolean;
  minimumOrder: number;
  estimatedTimeMin: number;
  estimatedTimeMax: number;
  serviceFeePercentage: number;
  primaryColor: string;
  secondaryColor: string;
  status: EntityStatus;
}

export interface PublicBusinessHour {
  weekday: number;
  opens: string;
  closes: string;
  closed: boolean;
}

export interface PublicKitchenSector {
  id: string;
  name: string;
  type: KitchenSectorType;
  position: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  position: number;
  availableFrom: string | null;
  availableTo: string | null;
}

export interface PublicOptionItem {
  id: string;
  optionGroupId: string;
  name: string;
  price: number;
  position: number;
}

export interface PublicOptionGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  selection: "single" | "multiple";
  position: number;
}

export interface PublicProductVariation {
  id: string;
  productId: string;
  name: string;
  priceDelta: number;
  /** false = shown as sold-out / not selectable */
  available: boolean;
  position: number;
}

export interface PublicProduct {
  id: string;
  categoryId: string | null;
  sectorId: string | null;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  promoPrice: number | null;
  prepMinutes: number;
  /** false = sold-out (still listed when active); inactive products are omitted entirely */
  available: boolean;
  featured: boolean;
  removableIngredients: string[];
  channels: string[];
  position: number;
  optionGroupIds: string[];
}

/** Admin catalog DTO (edit form). */
export interface AdminProductVariation {
  id: string;
  name: string;
  priceDelta: number;
  available: boolean;
  position: number;
}

export interface AdminOptionItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  position: number;
}

export interface AdminOptionGroupRef {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  selection: "single" | "multiple";
  position: number;
  active: boolean;
  items: AdminOptionItem[];
}

/** Admin category DTO. */
export interface AdminCategory {
  id: string;
  name: string;
  position: number;
  active: boolean;
  availableFrom: string | null;
  availableTo: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Admin option group DTO (edit form, with nested items). */
export interface AdminOptionGroup {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  selection: "single" | "multiple";
  position: number;
  active: boolean;
  items: AdminOptionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  promoPrice: number | null;
  categoryId: string | null;
  sectorId: string | null;
  active: boolean;
  available: boolean;
  featured: boolean;
  prepMinutes: number;
  sku: string | null;
  position: number;
  channels: string[];
  removableIngredients: string[];
  variations: AdminProductVariation[];
  optionGroups: AdminOptionGroupRef[];
  createdAt: string;
  updatedAt: string;
}

/** Admin settings for the current establishment. */
export interface EstablishmentSettings {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  cnpj: string | null;
  description: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  logoUrl: string | null;
  isOpen: boolean;
  minimumOrder: number;
  estimatedTimeMin: number;
  estimatedTimeMax: number;
  serviceFeePercentage: number;
  primaryColor: string;
  businessHours: PublicBusinessHour[];
}

export interface PublicMenuResponse {
  establishment: PublicEstablishment;
  businessHours: PublicBusinessHour[];
  kitchenSectors: PublicKitchenSector[];
  categories: PublicCategory[];
  products: PublicProduct[];
  variations: PublicProductVariation[];
  optionGroups: PublicOptionGroup[];
  optionItems: PublicOptionItem[];
}
