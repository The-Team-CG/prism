-- Phase 5 portal hardening, notification queue states, upload validation, guest records, and AI governance foundation.

ALTER TABLE "ops_documents"
  ADD COLUMN "generated_file_name" TEXT,
  ADD COLUMN "validation_status" TEXT NOT NULL DEFAULT 'accepted',
  ADD COLUMN "rejection_reason" TEXT;

ALTER TABLE "ops_supplier_quote_requests"
  ADD COLUMN "assignment_status" TEXT NOT NULL DEFAULT 'pending_confirmation',
  ADD COLUMN "assignment_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "readiness_status" TEXT NOT NULL DEFAULT 'not_requested',
  ADD COLUMN "readiness_confirmed_at" TIMESTAMP(3),
  ADD COLUMN "readiness_notes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "event_day_status" TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN "event_day_status_at" TIMESTAMP(3),
  ADD COLUMN "event_day_notes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "status_photo_file_name" TEXT,
  ADD COLUMN "contract_document_id" TEXT;

ALTER TABLE "ops_notification_logs"
  ALTER COLUMN "status" SET DEFAULT 'queued',
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failure_reason" TEXT,
  ADD COLUMN "sent_at" TIMESTAMP(3),
  ADD COLUMN "failed_at" TIMESTAMP(3),
  ADD COLUMN "acknowledged_at" TIMESTAMP(3);

UPDATE "ops_notification_logs"
SET "status" = 'queued'
WHERE "status" = 'logged_mock';

CREATE TABLE "ops_guest_check_ins" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "guest_name" TEXT NOT NULL,
  "check_in_mode" TEXT NOT NULL DEFAULT 'name_search',
  "status" TEXT NOT NULL DEFAULT 'checked_in',
  "walk_in" BOOLEAN NOT NULL DEFAULT false,
  "verification_status" TEXT NOT NULL DEFAULT 'verified',
  "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_guest_check_ins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_guest_feedback" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "guest_name" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL DEFAULT '',
  "photo_file_name" TEXT,
  "video_file_name" TEXT,
  "moderation_status" TEXT NOT NULL DEFAULT 'pending_review',
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_guest_feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_ai_audit_logs" (
  "id" TEXT NOT NULL,
  "event_id" TEXT,
  "feature_name" TEXT NOT NULL,
  "model_version" TEXT NOT NULL,
  "data_categories" JSONB NOT NULL DEFAULT '[]',
  "sanitized_payload" JSONB NOT NULL DEFAULT '{}',
  "zdr_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "human_approval_required" BOOLEAN NOT NULL DEFAULT true,
  "human_approved" BOOLEAN,
  "status" TEXT NOT NULL DEFAULT 'blocked',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_ai_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_ai_approval_records" (
  "id" TEXT NOT NULL,
  "ai_audit_log_id" TEXT NOT NULL,
  "event_id" TEXT,
  "feature_name" TEXT NOT NULL,
  "requested_by" TEXT NOT NULL DEFAULT 'PMCM Admin',
  "human_approved" BOOLEAN NOT NULL DEFAULT false,
  "approved_by" TEXT,
  "approved_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'pending_human_approval',
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_ai_approval_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_notification_logs_status_created_at_idx" ON "ops_notification_logs"("status", "created_at");
CREATE INDEX "ops_guest_check_ins_event_id_checked_in_at_idx" ON "ops_guest_check_ins"("event_id", "checked_in_at");
CREATE INDEX "ops_guest_check_ins_event_id_guest_name_idx" ON "ops_guest_check_ins"("event_id", "guest_name");
CREATE INDEX "ops_guest_feedback_event_id_moderation_status_idx" ON "ops_guest_feedback"("event_id", "moderation_status");
CREATE INDEX "ops_ai_audit_logs_feature_name_created_at_idx" ON "ops_ai_audit_logs"("feature_name", "created_at");
CREATE INDEX "ops_ai_audit_logs_status_created_at_idx" ON "ops_ai_audit_logs"("status", "created_at");
CREATE INDEX "ops_ai_approval_records_ai_audit_log_id_idx" ON "ops_ai_approval_records"("ai_audit_log_id");
CREATE INDEX "ops_ai_approval_records_status_requested_at_idx" ON "ops_ai_approval_records"("status", "requested_at");

ALTER TABLE "ops_supplier_quote_requests"
  ADD CONSTRAINT "ops_supplier_quote_requests_contract_document_id_fkey"
  FOREIGN KEY ("contract_document_id") REFERENCES "ops_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_guest_check_ins"
  ADD CONSTRAINT "ops_guest_check_ins_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_guest_feedback"
  ADD CONSTRAINT "ops_guest_feedback_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_ai_audit_logs"
  ADD CONSTRAINT "ops_ai_audit_logs_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_ai_approval_records"
  ADD CONSTRAINT "ops_ai_approval_records_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
