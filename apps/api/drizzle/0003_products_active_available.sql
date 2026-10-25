-- Product catalog status + integrity checks/indexes for admin CRUD.
-- Does not rewrite frozen migrations 0000–0002.

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;

ALTER TABLE "product_variations"
  ADD COLUMN IF NOT EXISTS "available" boolean DEFAULT true NOT NULL;

ALTER TABLE "products"
  ADD CONSTRAINT "products_price_nonnegative"
  CHECK ("price" >= 0);

ALTER TABLE "products"
  ADD CONSTRAINT "products_promo_price_nonnegative"
  CHECK ("promo_price" IS NULL OR "promo_price" >= 0);

ALTER TABLE "option_groups"
  ADD CONSTRAINT "option_groups_min_select_nonnegative"
  CHECK ("min_select" >= 0);

ALTER TABLE "option_groups"
  ADD CONSTRAINT "option_groups_max_select_positive"
  CHECK ("max_select" >= 1);

ALTER TABLE "option_groups"
  ADD CONSTRAINT "option_groups_min_lte_max"
  CHECK ("min_select" <= "max_select");

CREATE INDEX IF NOT EXISTS "idx_products_est_position"
  ON "products" ("establishment_id", "position");

CREATE INDEX IF NOT EXISTS "idx_products_est_category_position"
  ON "products" ("establishment_id", "category_id", "position");

CREATE INDEX IF NOT EXISTS "idx_categories_est_position"
  ON "categories" ("establishment_id", "position");

CREATE INDEX IF NOT EXISTS "idx_option_groups_est_position"
  ON "option_groups" ("establishment_id", "position");

CREATE INDEX IF NOT EXISTS "idx_product_variations_est_product_position"
  ON "product_variations" ("establishment_id", "product_id", "position");

CREATE INDEX IF NOT EXISTS "idx_option_items_est_group_position"
  ON "option_items" ("establishment_id", "option_group_id", "position");
