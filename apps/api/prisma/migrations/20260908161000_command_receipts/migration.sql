CREATE TABLE "trust_ops"."command_receipts" (
  "id" TEXT NOT NULL,
  "command_name" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "actor_role" TEXT NOT NULL,
  "event_id" TEXT,
  "correlation_id" TEXT NOT NULL,
  "payload_hash" TEXT,
  "result" JSONB,
  "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "command_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "command_receipts_command_key_actor_key"
  ON "trust_ops"."command_receipts"("command_name", "idempotency_key", "actor_id");

CREATE INDEX "command_receipts_event_id_created_at_idx"
  ON "trust_ops"."command_receipts"("event_id", "created_at");

CREATE INDEX "command_receipts_actor_id_created_at_idx"
  ON "trust_ops"."command_receipts"("actor_id", "created_at");
