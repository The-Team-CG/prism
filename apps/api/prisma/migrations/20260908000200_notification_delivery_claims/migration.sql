ALTER TABLE "trust_ops"."notification_logs"
  ADD COLUMN "idempotency_key" TEXT,
  ADD COLUMN "payload_hash" TEXT,
  ADD COLUMN "provider_receipt" TEXT,
  ADD COLUMN "lease_token" TEXT,
  ADD COLUMN "lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "notification_logs_idempotency_key_key"
  ON "trust_ops"."notification_logs"("idempotency_key");
CREATE INDEX "notification_logs_status_next_attempt_at_idx"
  ON "trust_ops"."notification_logs"("status", "next_attempt_at");
