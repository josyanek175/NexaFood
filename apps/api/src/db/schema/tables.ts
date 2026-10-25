import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import {
  appRoleEnum,
  entityStatusEnum,
  kitchenSectorTypeEnum,
  kitchenItemStatusEnum,
  orderChannelEnum,
  orderModeEnum,
  orderStatusEnum,
  paymentMethodEnum,
  tableStatusEnum,
} from "./enums.js";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/** Auth identity — password_hash must never be returned by API DTOs. Email stored normalized (lowercase). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    fullName: text("full_name").notNull().default(""),
    status: entityStatusEnum("status").notNull().default("ACTIVE"),
    ...timestamps,
  },
  (t) => [unique("users_email_unique").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    currentEstablishmentId: uuid("current_establishment_id").references(
      (): AnyPgColumn => establishments.id,
      { onDelete: "set null" },
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [
    unique("sessions_token_hash_unique").on(t.tokenHash),
    index("idx_sessions_token_hash").on(t.tokenHash),
    index("idx_sessions_user_id").on(t.userId),
  ],
);

export const platformAdmins = pgTable("platform_admins", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  document: text("document"),
  status: entityStatusEnum("status").notNull().default("ACTIVE"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  ...timestamps,
});

export const establishments = pgTable(
  "establishments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    legalName: text("legal_name"),
    cnpj: text("cnpj"),
    logoUrl: text("logo_url"),
    coverUrl: text("cover_url"),
    description: text("description"),
    address: text("address"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    status: entityStatusEnum("status").notNull().default("ACTIVE"),
    isOpen: boolean("is_open").notNull().default(false),
    timezone: text("timezone").notNull().default("America/Sao_Paulo"),
    currency: text("currency").notNull().default("BRL"),
    primaryColor: text("primary_color").notNull().default("#E2603B"),
    secondaryColor: text("secondary_color").notNull().default("#1F1B18"),
    minimumOrder: numeric("minimum_order", { precision: 10, scale: 2 }).notNull().default("0"),
    estimatedTimeMin: integer("estimated_time_min").notNull().default(20),
    estimatedTimeMax: integer("estimated_time_max").notNull().default(45),
    serviceFeePercentage: numeric("service_fee_percentage", { precision: 5, scale: 2 })
      .notNull()
      .default("0"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("idx_establishments_org").on(t.organizationId),
    check("establishments_slug_format", sql`${t.slug} ~ '^[a-z0-9-]{3,60}$'`),
    check("establishments_eta_check", sql`${t.estimatedTimeMax} >= ${t.estimatedTimeMin}`),
  ],
);

export const establishmentUsers = pgTable(
  "establishment_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: appRoleEnum("role").notNull().default("ATTENDANT"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("establishment_users_establishment_id_user_id_unique").on(t.establishmentId, t.userId),
    index("idx_est_users_user").on(t.userId),
  ],
);

export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    opens: time("opens").notNull().default("18:00"),
    closes: time("closes").notNull().default("23:00"),
    closed: boolean("closed").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("business_hours_establishment_id_weekday_unique").on(t.establishmentId, t.weekday),
    check("business_hours_weekday_check", sql`${t.weekday} BETWEEN 0 AND 6`),
  ],
);

export const kitchenSectors = pgTable("kitchen_sectors", {
  id: uuid("id").primaryKey().defaultRandom(),
  establishmentId: uuid("establishment_id")
    .notNull()
    .references(() => establishments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: kitchenSectorTypeEnum("type").notNull().default("COZINHA"),
  printerName: text("printer_name"),
  active: boolean("active").notNull().default(true),
  position: integer("position").notNull().default(0),
  ...timestamps,
});

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    availableFrom: time("available_from"),
    availableTo: time("available_to"),
    ...timestamps,
  },
  (t) => [index("idx_categories_est_position").on(t.establishmentId, t.position)],
);

export const optionGroups = pgTable(
  "option_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    required: boolean("required").notNull().default(false),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    selection: text("selection").notNull().default("single"),
    position: integer("position").notNull().default(0),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    check("option_groups_selection_check", sql`${t.selection} IN ('single', 'multiple')`),
    check("option_groups_min_select_nonnegative", sql`${t.minSelect} >= 0`),
    check("option_groups_max_select_positive", sql`${t.maxSelect} >= 1`),
    check("option_groups_min_lte_max", sql`${t.minSelect} <= ${t.maxSelect}`),
    index("idx_option_groups_est_position").on(t.establishmentId, t.position),
  ],
);

export const optionItems = pgTable(
  "option_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    optionGroupId: uuid("option_group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: numeric("price").notNull().default("0"),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("idx_option_items_est_group_position").on(
      t.establishmentId,
      t.optionGroupId,
      t.position,
    ),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    sectorId: uuid("sector_id").references(() => kitchenSectors.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    price: numeric("price").notNull().default("0"),
    promoPrice: numeric("promo_price"),
    sku: text("sku"),
    prepMinutes: integer("prep_minutes").notNull().default(15),
    /** Catalog visibility: false = hidden from public menu. */
    active: boolean("active").notNull().default(true),
    /** Sellability: false = shown as sold-out when active. */
    available: boolean("available").notNull().default(true),
    featured: boolean("featured").notNull().default(false),
    trackStock: boolean("track_stock").notNull().default(false),
    stock: integer("stock"),
    removableIngredients: text("removable_ingredients")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    channels: text("channels")
      .array()
      .notNull()
      .default(sql`'{cardapio,mesa,balcao}'::text[]`),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("idx_products_est_cat").on(t.establishmentId, t.categoryId),
    index("idx_products_est_position").on(t.establishmentId, t.position),
    index("idx_products_est_category_position").on(t.establishmentId, t.categoryId, t.position),
    check("products_price_nonnegative", sql`${t.price} >= 0`),
    check("products_promo_price_nonnegative", sql`${t.promoPrice} IS NULL OR ${t.promoPrice} >= 0`),
  ],
);

export const productVariations = pgTable(
  "product_variations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceDelta: numeric("price_delta").notNull().default("0"),
    available: boolean("available").notNull().default(true),
    position: integer("position").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("idx_product_variations_est_product_position").on(
      t.establishmentId,
      t.productId,
      t.position,
    ),
  ],
);

export const productOptionGroups = pgTable(
  "product_option_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    optionGroupId: uuid("option_group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("product_option_groups_product_id_option_group_id_unique").on(
      t.productId,
      t.optionGroupId,
    ),
  ],
);

export const restaurantTables = pgTable(
  "restaurant_tables",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    seats: integer("seats").notNull().default(4),
    status: tableStatusEnum("status").notNull().default("LIVRE"),
    qrToken: text("qr_token")
      .notNull()
      .default(sql`replace(gen_random_uuid()::text, '-', '')`),
    currentTotal: numeric("current_total").notNull().default("0"),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [unique("restaurant_tables_establishment_id_number_unique").on(t.establishmentId, t.number)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    email: text("email"),
    birthdate: date("birthdate"),
    consent: boolean("consent").notNull().default(false),
    notes: text("notes"),
    ordersCount: integer("orders_count").notNull().default(0),
    totalSpent: numeric("total_spent").notNull().default("0"),
    lastOrderAt: timestamp("last_order_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique("customers_establishment_id_phone_unique").on(t.establishmentId, t.phone)],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    publicToken: text("public_token")
      .notNull()
      .default(sql`replace(gen_random_uuid()::text, '-', '')`),
    channel: orderChannelEnum("channel").notNull().default("CARDAPIO"),
    mode: orderModeEnum("mode").notNull().default("DELIVERY"),
    status: orderStatusEnum("status").notNull().default("ENVIADO"),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    customerName: text("customer_name").notNull().default(""),
    customerPhone: text("customer_phone"),
    tableId: uuid("table_id").references(() => restaurantTables.id, { onDelete: "set null" }),
    tableNumber: integer("table_number"),
    address: text("address"),
    subtotal: numeric("subtotal").notNull().default("0"),
    discount: numeric("discount").notNull().default("0"),
    deliveryFee: numeric("delivery_fee").notNull().default("0"),
    serviceFee: numeric("service_fee").notNull().default("0"),
    total: numeric("total").notNull().default("0"),
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("PIX"),
    changeFor: numeric("change_for"),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [
    unique("orders_establishment_id_code_unique").on(t.establishmentId, t.code),
    unique("orders_public_token_unique").on(t.publicToken),
    index("idx_orders_est_created").on(t.establishmentId, t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    variationName: text("variation_name"),
    quantity: integer("quantity").notNull().default(1),
    unitPrice: numeric("unit_price").notNull().default("0"),
    sector: text("sector").notNull().default("cozinha"),
    /** KDS board column for this line item. */
    kitchenStatus: kitchenItemStatusEnum("kitchen_status").notNull().default("NOVO"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    removed: text("removed")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    notes: text("notes"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_order_items_est_kitchen_status").on(t.establishmentId, t.kitchenStatus)],
);

export const orderItemOptions = pgTable("order_item_options", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderItemId: uuid("order_item_id")
    .notNull()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  establishmentId: uuid("establishment_id")
    .notNull()
    .references(() => establishments.id, { onDelete: "cascade" }),
  groupName: text("group_name").notNull(),
  itemName: text("item_name").notNull(),
  price: numeric("price").notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderStatusEvents = pgTable("order_status_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  establishmentId: uuid("establishment_id")
    .notNull()
    .references(() => establishments.id, { onDelete: "cascade" }),
  status: orderStatusEnum("status").notNull(),
  changedBy: uuid("changed_by").references(() => users.id, { onDelete: "set null" }),
  changedByName: text("changed_by_name").notNull().default("Sistema"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
