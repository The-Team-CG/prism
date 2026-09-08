CREATE TABLE "identity"."password_reset_rate_limits" (
  "id" TEXT NOT NULL,
  "normalized_email" TEXT NOT NULL,
  "client_ip" TEXT NOT NULL,
  "window_started_at" TIMESTAMP(3) NOT NULL,
  "request_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "password_reset_rate_limits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_rate_limits_email_ip_key"
  ON "identity"."password_reset_rate_limits"("normalized_email", "client_ip");
CREATE INDEX "password_reset_rate_limits_window_started_at_idx"
  ON "identity"."password_reset_rate_limits"("window_started_at");
