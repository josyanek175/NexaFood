-- Same-tenant referential integrity for menu associations.
-- Pattern: UNIQUE(id, establishment_id) on parents + composite FK from children.
-- Does not rewrite frozen migrations 0000/0001.

CREATE OR REPLACE FUNCTION nexa_drop_fk_on_columns(p_table text, p_cols text[])
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = p_table
      AND c.contype = 'f'
      AND (
        SELECT array_agg(a.attname::text ORDER BY u.ord)
        FROM unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord)
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = u.attnum
      ) = p_cols
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table, r.conname);
  END LOOP;
END;
$$;

ALTER TABLE "categories"
  ADD CONSTRAINT "categories_id_establishment_id_unique" UNIQUE ("id", "establishment_id");

ALTER TABLE "kitchen_sectors"
  ADD CONSTRAINT "kitchen_sectors_id_establishment_id_unique" UNIQUE ("id", "establishment_id");

ALTER TABLE "products"
  ADD CONSTRAINT "products_id_establishment_id_unique" UNIQUE ("id", "establishment_id");

ALTER TABLE "option_groups"
  ADD CONSTRAINT "option_groups_id_establishment_id_unique" UNIQUE ("id", "establishment_id");

SELECT nexa_drop_fk_on_columns('products', ARRAY['category_id']);
SELECT nexa_drop_fk_on_columns('products', ARRAY['sector_id']);
SELECT nexa_drop_fk_on_columns('product_variations', ARRAY['product_id']);
SELECT nexa_drop_fk_on_columns('option_items', ARRAY['option_group_id']);
SELECT nexa_drop_fk_on_columns('product_option_groups', ARRAY['product_id']);
SELECT nexa_drop_fk_on_columns('product_option_groups', ARRAY['option_group_id']);

ALTER TABLE "products"
  ADD CONSTRAINT "products_category_establishment_fkey"
  FOREIGN KEY ("category_id", "establishment_id")
  REFERENCES "categories" ("id", "establishment_id")
  ON DELETE SET NULL;

ALTER TABLE "products"
  ADD CONSTRAINT "products_sector_establishment_fkey"
  FOREIGN KEY ("sector_id", "establishment_id")
  REFERENCES "kitchen_sectors" ("id", "establishment_id")
  ON DELETE SET NULL;

ALTER TABLE "product_variations"
  ADD CONSTRAINT "product_variations_product_establishment_fkey"
  FOREIGN KEY ("product_id", "establishment_id")
  REFERENCES "products" ("id", "establishment_id")
  ON DELETE CASCADE;

ALTER TABLE "option_items"
  ADD CONSTRAINT "option_items_group_establishment_fkey"
  FOREIGN KEY ("option_group_id", "establishment_id")
  REFERENCES "option_groups" ("id", "establishment_id")
  ON DELETE CASCADE;

ALTER TABLE "product_option_groups"
  ADD CONSTRAINT "product_option_groups_product_establishment_fkey"
  FOREIGN KEY ("product_id", "establishment_id")
  REFERENCES "products" ("id", "establishment_id")
  ON DELETE CASCADE;

ALTER TABLE "product_option_groups"
  ADD CONSTRAINT "product_option_groups_group_establishment_fkey"
  FOREIGN KEY ("option_group_id", "establishment_id")
  REFERENCES "option_groups" ("id", "establishment_id")
  ON DELETE CASCADE;

DROP FUNCTION nexa_drop_fk_on_columns(text, text[]);
