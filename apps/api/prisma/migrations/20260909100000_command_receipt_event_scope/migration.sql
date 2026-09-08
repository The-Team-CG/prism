ALTER TABLE "trust_ops"."command_receipts"
  ADD COLUMN "event_scope" TEXT;

UPDATE "trust_ops"."command_receipts"
SET "event_scope" = COALESCE("event_id", '__global__');

ALTER TABLE "trust_ops"."command_receipts"
  ALTER COLUMN "event_scope" SET NOT NULL;

DROP INDEX "trust_ops"."command_receipts_command_key_actor_key";

CREATE UNIQUE INDEX "command_receipts_command_key_actor_scope_key"
  ON "trust_ops"."command_receipts"("command_name", "idempotency_key", "actor_id", "event_scope");
