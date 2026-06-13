ALTER TABLE "ops_notification_logs"
  ADD COLUMN "correlation_id" TEXT;

CREATE INDEX "ops_notification_logs_correlation_id_idx"
  ON "ops_notification_logs"("correlation_id");
