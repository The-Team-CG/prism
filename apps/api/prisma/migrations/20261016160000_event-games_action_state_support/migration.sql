-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Persist server-owned round, pause, and team state for authoritative play.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."game_sessions"
    ADD COLUMN "paused_at" TIMESTAMPTZ(6),
    ADD COLUMN "total_paused_ms" BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT "game_sessions_total_paused_ms_check"
        CHECK ("total_paused_ms" >= 0);

ALTER TABLE "event_games"."session_participation_grants"
    ADD COLUMN "team_id" TEXT,
    ADD COLUMN "team_label" TEXT,
    ADD CONSTRAINT "session_participation_grants_team_shape_check"
        CHECK (("team_id" IS NULL AND "team_label" IS NULL) OR
          ("team_id" IS NOT NULL AND NULLIF(BTRIM("team_label"), '') IS NOT NULL));

CREATE INDEX "session_participation_grants_event_session_team_idx"
    ON "event_games"."session_participation_grants"("event_id", "session_id", "team_id")
    WHERE "team_id" IS NOT NULL;

ALTER TABLE "event_games"."submissions"
    ADD COLUMN "round_number" INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT "submissions_round_number_check" CHECK ("round_number" > 0);

COMMIT;
