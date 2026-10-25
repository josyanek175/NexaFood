-- Per-item kitchen board status (KDS), independent from order-level status.

DO $$ BEGIN
  CREATE TYPE "kitchen_item_status" AS ENUM ('NOVO', 'PREPARANDO', 'PRONTO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "kitchen_status" "kitchen_item_status" DEFAULT 'NOVO' NOT NULL;

ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "ready_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_order_items_est_kitchen_status"
  ON "order_items" ("establishment_id", "kitchen_status");
