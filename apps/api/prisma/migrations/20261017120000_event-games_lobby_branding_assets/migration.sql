-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Store accessible event lobby colors and a reference to its validated event-owned logo.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."lobby_slugs"
    ADD COLUMN "brand_primary_color" TEXT,
    ADD COLUMN "brand_secondary_color" TEXT,
    ADD COLUMN "brand_logo_object_id" TEXT,
    ADD CONSTRAINT "lobby_slugs_brand_primary_color_check"
        CHECK ("brand_primary_color" IS NULL OR "brand_primary_color" ~ '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT "lobby_slugs_brand_secondary_color_check"
        CHECK ("brand_secondary_color" IS NULL OR "brand_secondary_color" ~ '^#[0-9A-Fa-f]{6}$'),
    ADD CONSTRAINT "lobby_slugs_brand_logo_object_id_check"
        CHECK ("brand_logo_object_id" IS NULL OR "brand_logo_object_id" ~ '^obj_[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89AaBb][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$');

COMMIT;
