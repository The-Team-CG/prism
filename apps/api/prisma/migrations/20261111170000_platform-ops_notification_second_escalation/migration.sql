-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

-- A recipient who still has not acknowledged after the first escalation is chased once more. The column records that
-- second escalation so each deadline escalates at most twice, however many sweeps or API instances run.
ALTER TABLE "platform_ops"."notification_deliveries" ADD COLUMN "second_escalated_at" TIMESTAMP(3);

CREATE INDEX "notification_deliveries_second_escalation_idx"
  ON "platform_ops"."notification_deliveries"("acknowledged_at", "second_escalated_at", "escalated_at");
