-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Persist only a keyed digest to make PIN joins retry-safe without storing the submitted key.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."session_participation_grants"
    ADD COLUMN "join_idempotency_key_digest" TEXT;

CREATE UNIQUE INDEX "session_participation_grants_event_id_idempotency_key"
    ON "event_games"."session_participation_grants"("event_id", "join_idempotency_key_digest");

COMMIT;
