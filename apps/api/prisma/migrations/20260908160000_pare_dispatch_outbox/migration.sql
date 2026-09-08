CREATE TABLE "platform_ops"."pare_dispatches" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "source_updated_at" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "correlation_id" TEXT NOT NULL,
  "lease_token" TEXT,
  "lease_expires_at" TIMESTAMPTZ,
  "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "failure_reason" TEXT,
  "approval_record_id" TEXT,
  "completed_at" TIMESTAMPTZ,
  "failed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pare_dispatches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pare_dispatches_status_check" CHECK ("status" IN ('queued', 'succeeded', 'failed')),
  CONSTRAINT "pare_dispatches_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "pare_dispatches_lease_pair_check" CHECK (("lease_token" IS NULL AND "lease_expires_at" IS NULL) OR ("lease_token" IS NOT NULL AND "lease_expires_at" IS NOT NULL)),
  CONSTRAINT "pare_dispatches_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "pare_dispatches_request_source_updated_key"
  ON "platform_ops"."pare_dispatches"("request_id", "source_updated_at");
CREATE INDEX "pare_dispatches_event_status_idx"
  ON "platform_ops"."pare_dispatches"("event_id", "status");
CREATE INDEX "pare_dispatches_status_next_attempt_idx"
  ON "platform_ops"."pare_dispatches"("status", "next_attempt_at");
CREATE INDEX "pare_dispatches_worker_claim_idx"
  ON "platform_ops"."pare_dispatches"("status", "next_attempt_at", "created_at", "id");
CREATE INDEX "pare_dispatches_correlation_id_idx"
  ON "platform_ops"."pare_dispatches"("correlation_id");

ALTER TABLE "trust_ops"."ai_approval_records"
  ADD COLUMN "source_dispatch_id" TEXT;

CREATE UNIQUE INDEX "ai_approval_records_source_dispatch_id_key"
  ON "trust_ops"."ai_approval_records"("source_dispatch_id");
