-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "platform_ops"."notification_logs" ADD COLUMN "action" JSONB;

CREATE TABLE "platform_ops"."notification_deliveries" (
  "id" TEXT NOT NULL,
  "notification_id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "provider_receipt" TEXT,
  "failure_reason" TEXT,
  "accepted_at" TIMESTAMP(3),
  "read_at" TIMESTAMP(3),
  "acknowledged_at" TIMESTAMP(3),
  "provider_outcome" TEXT,
  "acknowledgment_due_at" TIMESTAMP(3),
  "escalated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id")
    REFERENCES "platform_ops"."notification_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notification_deliveries_notification_recipient_key"
  ON "platform_ops"."notification_deliveries"("notification_id", "recipient");
CREATE INDEX "notification_deliveries_notification_status_idx"
  ON "platform_ops"."notification_deliveries"("notification_id", "status");
CREATE INDEX "notification_deliveries_recipient_created_idx"
  ON "platform_ops"."notification_deliveries"("recipient", "created_at", "id");
CREATE INDEX "notification_deliveries_provider_receipt_idx" ON "platform_ops"."notification_deliveries"("provider_receipt");
CREATE INDEX "notification_deliveries_ack_due_idx" ON "platform_ops"."notification_deliveries"("acknowledged_at", "escalated_at", "acknowledgment_due_at");
CREATE TABLE "platform_ops"."notification_provider_outcomes" (
  "receipt" TEXT NOT NULL PRIMARY KEY,
  "outcome" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notification_provider_outcomes_updated_idx" ON "platform_ops"."notification_provider_outcomes"("updated_at");
