-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Persist one host-selected Spin the Wheel result with its session.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."game_sessions"
    ADD COLUMN "wheel_result" JSONB,
    ADD CONSTRAINT "game_sessions_wheel_result_object_check"
        CHECK ("wheel_result" IS NULL OR jsonb_typeof("wheel_result") = 'object');

COMMIT;
