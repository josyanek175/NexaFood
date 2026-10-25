-- Auth phase A: sessions + case-insensitive email lookup index.
-- Does not rewrite frozen foundation migration.

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_unique";
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");

CREATE INDEX IF NOT EXISTS "idx_users_email_lower" ON "users" (lower("email"));

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "current_establishment_id" uuid,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "revoked_at" timestamptz,
  "ip_address" text,
  "user_agent" text,
  CONSTRAINT "sessions_token_hash_unique" UNIQUE ("token_hash")
);

CREATE INDEX IF NOT EXISTS "idx_sessions_token_hash" ON "sessions" ("token_hash");
CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" ("user_id");

-- Optional FK for current establishment (nullable; validated in app layer for membership).
DO $$
BEGIN
  ALTER TABLE "sessions"
    ADD CONSTRAINT "sessions_current_establishment_id_fkey"
    FOREIGN KEY ("current_establishment_id")
    REFERENCES "establishments"("id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
