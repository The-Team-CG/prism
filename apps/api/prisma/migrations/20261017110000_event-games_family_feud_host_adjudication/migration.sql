-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Persist host decisions for unscored Family Feud answers and guard against duplicate resolution.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."moderation_actions"
    ADD COLUMN "resolved_answer" TEXT;

CREATE UNIQUE INDEX "moderation_actions_family_feud_resolution_once"
    ON "event_games"."moderation_actions"("event_id", "session_id", "submission_id")
    WHERE "action" = 'resolve_family_feud_answer';

COMMIT;
