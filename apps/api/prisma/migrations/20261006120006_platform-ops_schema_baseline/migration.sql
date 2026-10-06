-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium
-- Owner-scoped baseline for the platform_ops schema.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform_ops";

-- CreateTable
CREATE TABLE "platform_ops"."privacy_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "subject_type" TEXT NOT NULL,
    "subject_email" TEXT NOT NULL DEFAULT '',
    "subject_name" TEXT NOT NULL DEFAULT '',
    "request_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "request_notes" TEXT NOT NULL DEFAULT '',
    "review_reason" TEXT NOT NULL DEFAULT '',
    "execution_notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "executed_by" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."privacy_legal_holds" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_email" TEXT NOT NULL DEFAULT '',
    "subject_name" TEXT NOT NULL DEFAULT '',
    "event_id" TEXT,
    "reason" TEXT NOT NULL,
    "placed_by_id" TEXT NOT NULL,
    "placed_by_name" TEXT NOT NULL,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "release_reason" TEXT,
    "released_by_id" TEXT,
    "released_by_name" TEXT,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "privacy_legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."audit_chain_locks" (
    "id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "head_id" TEXT,
    "head_hash" TEXT,

    CONSTRAINT "audit_chain_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."audit_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "actor" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL DEFAULT 'system',
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "action_type" TEXT NOT NULL DEFAULT 'general',
    "category" TEXT NOT NULL DEFAULT 'events',
    "affected_type" TEXT,
    "affected_id" TEXT,
    "affected_label" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT NOT NULL DEFAULT 'system',
    "device" TEXT NOT NULL DEFAULT 'P.R.I.S.M',
    "severity" TEXT NOT NULL DEFAULT 'info',
    "immutable_hash" TEXT NOT NULL,
    "previous_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."notification_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correlation_id" TEXT,
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "provider_receipt" TEXT,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failure_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."pare_dispatches" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "source_updated_at" TIMESTAMPTZ(6) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "correlation_id" TEXT NOT NULL,
    "lease_token" TEXT,
    "lease_expires_at" TIMESTAMPTZ(6),
    "next_attempt_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failure_reason" TEXT,
    "approval_record_id" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pare_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."command_receipts" (
    "id" TEXT NOT NULL,
    "command_name" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "event_scope" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "event_id" TEXT,
    "correlation_id" TEXT NOT NULL,
    "payload_hash" TEXT,
    "result" JSONB,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "command_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."stored_objects" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "owner_record_type" TEXT NOT NULL,
    "owner_record_id" TEXT NOT NULL,
    "usage" TEXT NOT NULL,
    "logical_target" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "declared_byte_size" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "uploader_actor_id" TEXT NOT NULL,
    "uploader_actor_role" TEXT NOT NULL,
    "lifecycle_state" TEXT NOT NULL DEFAULT 'requested',
    "provider_name" TEXT,
    "provider_object_key" TEXT,
    "failure_reason" TEXT,
    "idempotency_key" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stored_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."ai_audit_logs" (
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
    "request_id" TEXT,
    "correlation_id" TEXT,
    "use_case_id" TEXT,
    "prompt_version" TEXT,
    "profile_id" TEXT,
    "provider" TEXT,
    "requested_model" TEXT,
    "response_model" TEXT,
    "endpoint_tag" TEXT,
    "zdr_basis" TEXT,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "latency_ms" INTEGER,
    "outcome" TEXT,
    "approval_state" TEXT,
    "synthetic_provenance" JSONB,
    "failure_code" TEXT,
    "budget_date" DATE,
    "reserved_tokens" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."ai_daily_token_usage" (
    "id" TEXT NOT NULL,
    "use_case_id" TEXT NOT NULL,
    "usage_date" DATE NOT NULL,
    "reserved_tokens" INTEGER NOT NULL DEFAULT 0,
    "consumed_tokens" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_daily_token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."ai_approval_records" (
    "id" TEXT NOT NULL,
    "ai_audit_log_id" TEXT NOT NULL,
    "event_id" TEXT,
    "feature_name" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "human_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending_human_approval',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_dispatch_id" TEXT,
    "review_payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ai_approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."conforme_comms_drafts" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "reminder_window_base_at" TEXT NOT NULL,
    "decision_reminder_at" TEXT,
    "request_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conforme_comms_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."login_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL DEFAULT 'system',
    "device" TEXT NOT NULL DEFAULT 'P.R.I.S.M',
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ops"."security_alerts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "status" TEXT NOT NULL DEFAULT 'open',
    "triggered_by" TEXT NOT NULL DEFAULT 'System',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "security_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "privacy_requests_status_created_at_idx" ON "platform_ops"."privacy_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "privacy_requests_subject_email_idx" ON "platform_ops"."privacy_requests"("subject_email");

-- CreateIndex
CREATE INDEX "privacy_requests_event_id_idx" ON "platform_ops"."privacy_requests"("event_id");

-- CreateIndex
CREATE INDEX "privacy_legal_holds_email_active_idx" ON "platform_ops"."privacy_legal_holds"("subject_type", "subject_email", "released_at", "event_id");

-- CreateIndex
CREATE INDEX "privacy_legal_holds_name_active_idx" ON "platform_ops"."privacy_legal_holds"("subject_type", "subject_name", "released_at", "event_id");

-- CreateIndex
CREATE INDEX "audit_logs_event_id_created_at_idx" ON "platform_ops"."audit_logs"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_event_created_at_id_idx" ON "platform_ops"."audit_logs"("event_id", "created_at" DESC, "id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_created_at_idx" ON "platform_ops"."audit_logs"("actor", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "platform_ops"."audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_category_created_at_idx" ON "platform_ops"."audit_logs"("category", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_type_created_at_idx" ON "platform_ops"."audit_logs"("action_type", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_severity_created_at_idx" ON "platform_ops"."audit_logs"("severity", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_logs_idempotency_key_key" ON "platform_ops"."notification_logs"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_logs_event_id_created_at_idx" ON "platform_ops"."notification_logs"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_status_created_at_idx" ON "platform_ops"."notification_logs"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_logs_status_created_at_id_idx" ON "platform_ops"."notification_logs"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "notification_logs_correlation_id_idx" ON "platform_ops"."notification_logs"("correlation_id");

-- CreateIndex
CREATE INDEX "notification_logs_status_next_attempt_at_idx" ON "platform_ops"."notification_logs"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "pare_dispatches_event_status_idx" ON "platform_ops"."pare_dispatches"("event_id", "status");

-- CreateIndex
CREATE INDEX "pare_dispatches_approval_record_id_idx" ON "platform_ops"."pare_dispatches"("approval_record_id");

-- CreateIndex
CREATE INDEX "pare_dispatches_status_next_attempt_idx" ON "platform_ops"."pare_dispatches"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "pare_dispatches_worker_claim_idx" ON "platform_ops"."pare_dispatches"("status", "next_attempt_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "pare_dispatches_correlation_id_idx" ON "platform_ops"."pare_dispatches"("correlation_id");

-- CreateIndex
CREATE UNIQUE INDEX "pare_dispatches_request_source_updated_key" ON "platform_ops"."pare_dispatches"("request_id", "source_updated_at");

-- CreateIndex
CREATE INDEX "command_receipts_event_id_created_at_idx" ON "platform_ops"."command_receipts"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "command_receipts_actor_id_created_at_idx" ON "platform_ops"."command_receipts"("actor_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "command_receipts_command_key_actor_scope_key" ON "platform_ops"."command_receipts"("command_name", "idempotency_key", "actor_id", "event_scope");

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_idempotency_key_key" ON "platform_ops"."stored_objects"("idempotency_key");

-- CreateIndex
CREATE INDEX "stored_objects_event_id_lifecycle_state_idx" ON "platform_ops"."stored_objects"("event_id", "lifecycle_state");

-- CreateIndex
CREATE INDEX "stored_objects_owner_record_idx" ON "platform_ops"."stored_objects"("owner_record_type", "owner_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "stored_objects_event_usage_logical_target_key" ON "platform_ops"."stored_objects"("event_id", "usage", "logical_target");

-- CreateIndex
CREATE UNIQUE INDEX "ai_audit_logs_request_id_key" ON "platform_ops"."ai_audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_event_id_idx" ON "platform_ops"."ai_audit_logs"("event_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_feature_name_created_at_idx" ON "platform_ops"."ai_audit_logs"("feature_name", "created_at");

-- CreateIndex
CREATE INDEX "ai_audit_logs_status_created_at_idx" ON "platform_ops"."ai_audit_logs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_daily_token_usage_use_case_date_key" ON "platform_ops"."ai_daily_token_usage"("use_case_id", "usage_date");

-- CreateIndex
CREATE UNIQUE INDEX "ai_approval_records_source_dispatch_id_key" ON "platform_ops"."ai_approval_records"("source_dispatch_id");

-- CreateIndex
CREATE INDEX "ai_approval_records_ai_audit_log_id_idx" ON "platform_ops"."ai_approval_records"("ai_audit_log_id");

-- CreateIndex
CREATE INDEX "ai_approval_records_event_id_idx" ON "platform_ops"."ai_approval_records"("event_id");

-- CreateIndex
CREATE INDEX "ai_approval_records_status_requested_at_idx" ON "platform_ops"."ai_approval_records"("status", "requested_at");

-- CreateIndex
CREATE INDEX "conforme_comms_drafts_inquiry_id_created_at_idx" ON "platform_ops"."conforme_comms_drafts"("inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "login_history_user_id_created_at_idx" ON "platform_ops"."login_history"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "login_history_email_created_at_idx" ON "platform_ops"."login_history"("email", "created_at");

-- CreateIndex
CREATE INDEX "login_history_status_created_at_idx" ON "platform_ops"."login_history"("status", "created_at");

-- CreateIndex
CREATE INDEX "security_alerts_event_id_idx" ON "platform_ops"."security_alerts"("event_id");

-- CreateIndex
CREATE INDEX "security_alerts_status_created_at_idx" ON "platform_ops"."security_alerts"("status", "created_at");

-- CreateIndex
CREATE INDEX "security_alerts_type_created_at_idx" ON "platform_ops"."security_alerts"("type", "created_at");

-- CreateIndex
CREATE INDEX "security_alerts_severity_created_at_idx" ON "platform_ops"."security_alerts"("severity", "created_at");

-- AddForeignKey
ALTER TABLE "platform_ops"."pare_dispatches" ADD CONSTRAINT "pare_dispatches_approval_record_id_fkey" FOREIGN KEY ("approval_record_id") REFERENCES "platform_ops"."ai_approval_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ops"."ai_approval_records" ADD CONSTRAINT "ai_approval_records_ai_audit_log_id_fkey" FOREIGN KEY ("ai_audit_log_id") REFERENCES "platform_ops"."ai_audit_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_ops"."conforme_comms_drafts" ADD CONSTRAINT "conforme_comms_drafts_id_fkey" FOREIGN KEY ("id") REFERENCES "platform_ops"."ai_approval_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

COMMIT;
