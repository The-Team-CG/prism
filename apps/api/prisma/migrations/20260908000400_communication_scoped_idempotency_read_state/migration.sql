DROP INDEX IF EXISTS "supplier_ops"."communication_messages_idempotency_key_key";

ALTER TABLE "supplier_ops"."communication_participants"
ADD COLUMN "last_read_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "communication_messages_thread_id_idempotency_key_key"
ON "supplier_ops"."communication_messages"("thread_id", "idempotency_key");
