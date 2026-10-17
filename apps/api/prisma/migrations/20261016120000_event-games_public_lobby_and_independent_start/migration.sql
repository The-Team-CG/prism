-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Add opaque event lobby slugs, Independent availability windows, and globally event-bound credentials.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "event_games"."lobby_slugs" (
    "event_id" TEXT NOT NULL,
    "lobby_slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lobby_slugs_pkey" PRIMARY KEY ("event_id")
);

ALTER TABLE "event_games"."game_definitions"
  ADD COLUMN "available_from" TIMESTAMPTZ(6),
  ADD COLUMN "available_until" TIMESTAMPTZ(6),
  ADD CONSTRAINT "game_definitions_availability_window_check"
    CHECK ("available_from" IS NULL OR "available_until" IS NULL OR "available_until" > "available_from");

DROP INDEX "event_games"."participant_credentials_event_digest_key";
CREATE UNIQUE INDEX "participant_credentials_token_digest_key"
  ON "event_games"."participant_credentials"("token_digest");
CREATE UNIQUE INDEX "lobby_slugs_slug_key" ON "event_games"."lobby_slugs"("lobby_slug");

COMMIT;
