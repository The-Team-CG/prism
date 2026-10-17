-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Store only the keyed issuance request digest and bounded candidate index for one-time PIN reveal.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "event_games"."active_pin_reservations"
    ADD COLUMN "issue_idempotency_key_digest" TEXT,
    ADD COLUMN "generation_attempt" INTEGER;

CREATE UNIQUE INDEX "active_pin_reservations_event_issue_key_key"
    ON "event_games"."active_pin_reservations"("event_id", "issue_idempotency_key_digest");

COMMIT;
