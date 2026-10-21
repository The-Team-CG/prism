-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Persist an allowlisted visual theme and the actor/time of lobby branding updates.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."lobby_slugs"
    ADD COLUMN "brand_theme" TEXT NOT NULL DEFAULT 'prism',
    ADD COLUMN "brand_updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    ADD COLUMN "brand_updated_by" TEXT,
    ADD CONSTRAINT "lobby_slugs_brand_theme_check"
        CHECK ("brand_theme" IN ('prism', 'ocean', 'sunset', 'forest'));

COMMIT;
