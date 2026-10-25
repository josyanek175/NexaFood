CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE "public"."app_role" AS ENUM(
  'PLATFORM_ADMIN',
  'ESTABLISHMENT_ADMIN',
  'MANAGER',
  'CASHIER',
  'ATTENDANT',
  'KITCHEN',
  'DELIVERY_DRIVER'
);

CREATE TYPE "public"."entity_status" AS ENUM('ACTIVE', 'SUSPENDED', 'TRIAL', 'INACTIVE');

CREATE TYPE "public"."kitchen_sector_type" AS ENUM('COZINHA', 'BAR', 'CHAPA', 'PIZZARIA', 'SOBREMESAS');

CREATE TYPE "public"."order_channel" AS ENUM('CARDAPIO', 'MESA', 'BALCAO', 'IFOOD', '99FOOD', 'MANUAL');

CREATE TYPE "public"."order_mode" AS ENUM('DELIVERY', 'RETIRADA', 'LOCAL');

CREATE TYPE "public"."order_status" AS ENUM(
  'ENVIADO',
  'CONFIRMADO',
  'PREPARANDO',
  'PRONTO',
  'EM_ENTREGA',
  'FINALIZADO',
  'CANCELADO'
);

CREATE TYPE "public"."payment_method" AS ENUM('PIX', 'CREDITO', 'DEBITO', 'DINHEIRO', 'CAIXA');

CREATE TYPE "public"."table_status" AS ENUM(
  'LIVRE',
  'OCUPADA',
  'AGUARDANDO_PEDIDO',
  'PREPARANDO',
  'AGUARDANDO_PAGAMENTO',
  'FECHADA'
);

CREATE OR REPLACE FUNCTION "public"."set_updated_at"()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text,
  "full_name" text DEFAULT '' NOT NULL,
  "status" "entity_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "platform_admins" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "legal_name" text,
  "document" text,
  "status" "entity_status" DEFAULT 'ACTIVE' NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "establishments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL UNIQUE,
  "legal_name" text,
  "cnpj" text,
  "logo_url" text,
  "cover_url" text,
  "description" text,
  "address" text,
  "phone" text,
  "whatsapp" text,
  "email" text,
  "status" "entity_status" DEFAULT 'ACTIVE' NOT NULL,
  "is_open" boolean DEFAULT false NOT NULL,
  "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
  "currency" text DEFAULT 'BRL' NOT NULL,
  "primary_color" text DEFAULT '#E2603B' NOT NULL,
  "secondary_color" text DEFAULT '#1F1B18' NOT NULL,
  "minimum_order" numeric(10, 2) DEFAULT '0' NOT NULL,
  "estimated_time_min" integer DEFAULT 20 NOT NULL,
  "estimated_time_max" integer DEFAULT 45 NOT NULL,
  "service_fee_percentage" numeric(5, 2) DEFAULT '0' NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "establishments_slug_format" CHECK ("slug" ~ '^[a-z0-9-]{3,60}$'),
  CONSTRAINT "establishments_eta_check" CHECK ("estimated_time_max" >= "estimated_time_min")
);

CREATE INDEX "idx_establishments_org" ON "establishments" ("organization_id");

CREATE TABLE "establishment_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" "app_role" DEFAULT 'ATTENDANT' NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "establishment_users_establishment_id_user_id_unique" UNIQUE ("establishment_id", "user_id")
);

CREATE INDEX "idx_est_users_user" ON "establishment_users" ("user_id");

CREATE TABLE "business_hours" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "weekday" smallint NOT NULL,
  "opens" time DEFAULT '18:00' NOT NULL,
  "closes" time DEFAULT '23:00' NOT NULL,
  "closed" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "business_hours_establishment_id_weekday_unique" UNIQUE ("establishment_id", "weekday"),
  CONSTRAINT "business_hours_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6)
);

CREATE TABLE "kitchen_sectors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "type" "kitchen_sector_type" DEFAULT 'COZINHA' NOT NULL,
  "printer_name" text,
  "active" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "available_from" time,
  "available_to" time,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "option_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "required" boolean DEFAULT false NOT NULL,
  "min_select" integer DEFAULT 0 NOT NULL,
  "max_select" integer DEFAULT 1 NOT NULL,
  "selection" text DEFAULT 'single' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "option_groups_selection_check" CHECK ("selection" IN ('single', 'multiple'))
);

CREATE TABLE "option_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "option_group_id" uuid NOT NULL REFERENCES "option_groups"("id") ON DELETE CASCADE,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "price" numeric DEFAULT '0' NOT NULL,
  "available" boolean DEFAULT true NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "products" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
  "sector_id" uuid REFERENCES "kitchen_sectors"("id") ON DELETE SET NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "image_url" text,
  "price" numeric DEFAULT '0' NOT NULL,
  "promo_price" numeric,
  "sku" text,
  "prep_minutes" integer DEFAULT 15 NOT NULL,
  "available" boolean DEFAULT true NOT NULL,
  "featured" boolean DEFAULT false NOT NULL,
  "track_stock" boolean DEFAULT false NOT NULL,
  "stock" integer,
  "removable_ingredients" text[] DEFAULT '{}'::text[] NOT NULL,
  "channels" text[] DEFAULT '{cardapio,mesa,balcao}'::text[] NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "idx_products_est_cat" ON "products" ("establishment_id", "category_id");

CREATE TABLE "product_variations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "price_delta" numeric DEFAULT '0' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "product_option_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "option_group_id" uuid NOT NULL REFERENCES "option_groups"("id") ON DELETE CASCADE,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "product_option_groups_product_id_option_group_id_unique" UNIQUE ("product_id", "option_group_id")
);

CREATE TABLE "restaurant_tables" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "number" integer NOT NULL,
  "seats" integer DEFAULT 4 NOT NULL,
  "status" "table_status" DEFAULT 'LIVRE' NOT NULL,
  "qr_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
  "current_total" numeric DEFAULT '0' NOT NULL,
  "opened_at" timestamptz,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "restaurant_tables_establishment_id_number_unique" UNIQUE ("establishment_id", "number")
);

CREATE TABLE "customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "birthdate" date,
  "consent" boolean DEFAULT false NOT NULL,
  "notes" text,
  "orders_count" integer DEFAULT 0 NOT NULL,
  "total_spent" numeric DEFAULT '0' NOT NULL,
  "last_order_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "customers_establishment_id_phone_unique" UNIQUE ("establishment_id", "phone")
);

CREATE TABLE "orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "code" text NOT NULL,
  "public_token" text DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL,
  "channel" "order_channel" DEFAULT 'CARDAPIO' NOT NULL,
  "mode" "order_mode" DEFAULT 'DELIVERY' NOT NULL,
  "status" "order_status" DEFAULT 'ENVIADO' NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "customer_name" text DEFAULT '' NOT NULL,
  "customer_phone" text,
  "table_id" uuid REFERENCES "restaurant_tables"("id") ON DELETE SET NULL,
  "table_number" integer,
  "address" text,
  "subtotal" numeric DEFAULT '0' NOT NULL,
  "discount" numeric DEFAULT '0' NOT NULL,
  "delivery_fee" numeric DEFAULT '0' NOT NULL,
  "service_fee" numeric DEFAULT '0' NOT NULL,
  "total" numeric DEFAULT '0' NOT NULL,
  "payment_method" "payment_method" DEFAULT 'PIX' NOT NULL,
  "change_for" numeric,
  "notes" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "orders_establishment_id_code_unique" UNIQUE ("establishment_id", "code"),
  CONSTRAINT "orders_public_token_unique" UNIQUE ("public_token")
);

CREATE INDEX "idx_orders_est_created" ON "orders" ("establishment_id", "created_at");

CREATE TABLE "order_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "product_id" uuid REFERENCES "products"("id") ON DELETE SET NULL,
  "product_name" text NOT NULL,
  "variation_name" text,
  "quantity" integer DEFAULT 1 NOT NULL,
  "unit_price" numeric DEFAULT '0' NOT NULL,
  "sector" text DEFAULT 'cozinha' NOT NULL,
  "removed" text[] DEFAULT '{}'::text[] NOT NULL,
  "notes" text,
  "position" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "order_item_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_item_id" uuid NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "group_name" text NOT NULL,
  "item_name" text NOT NULL,
  "price" numeric DEFAULT '0' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "order_status_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "establishment_id" uuid NOT NULL REFERENCES "establishments"("id") ON DELETE CASCADE,
  "status" "order_status" NOT NULL,
  "changed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "changed_by_name" text DEFAULT 'Sistema' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TRIGGER "trg_users_updated" BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_org_updated" BEFORE UPDATE ON "organizations"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_est_updated" BEFORE UPDATE ON "establishments"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_est_users_updated" BEFORE UPDATE ON "establishment_users"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_bh_updated" BEFORE UPDATE ON "business_hours"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_ks_updated" BEFORE UPDATE ON "kitchen_sectors"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_cat_updated" BEFORE UPDATE ON "categories"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_og_updated" BEFORE UPDATE ON "option_groups"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_oi_updated" BEFORE UPDATE ON "option_items"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_prod_updated" BEFORE UPDATE ON "products"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_pv_updated" BEFORE UPDATE ON "product_variations"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_rt_updated" BEFORE UPDATE ON "restaurant_tables"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_cust_updated" BEFORE UPDATE ON "customers"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE TRIGGER "trg_ord_updated" BEFORE UPDATE ON "orders"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
