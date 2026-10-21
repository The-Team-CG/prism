-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Persist host-controlled timeline advances without rewriting the session start timestamp.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."game_sessions"
    ADD COLUMN "round_offset_ms" INTEGER NOT NULL DEFAULT 0,
    ADD CONSTRAINT "game_sessions_round_offset_nonnegative_check"
        CHECK ("round_offset_ms" >= 0);

COMMIT;
