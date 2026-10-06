-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- Owner-scoped baseline for the event_lifecycle schema.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "event_lifecycle";

-- CreateTable
CREATE TABLE "event_lifecycle"."inquiries" (
    "id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "company_name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_type" TEXT NOT NULL DEFAULT 'Event',
    "event_date" TIMESTAMP(3) NOT NULL,
    "client_type" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'Website',
    "channel" TEXT,
    "normalized_email" TEXT NOT NULL DEFAULT '',
    "referral_details" TEXT NOT NULL DEFAULT '',
    "logged_by_role" TEXT,
    "logged_by_name" TEXT,
    "duplicate_of_inquiry_id" TEXT,
    "previous_declined_inquiry_id" TEXT,
    "previous_decline_reason" TEXT,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "decline_reason" TEXT,
    "accepted_at" TIMESTAMP(3),
    "pending_at" TIMESTAMP(3),
    "declined_at" TIMESTAMP(3),
    "conforme_sent_at" TIMESTAMP(3),
    "conforme_signed_at" TIMESTAMP(3),
    "portal_activated_at" TIMESTAMP(3),
    "follow_up_interval_days" INTEGER NOT NULL DEFAULT 3,
    "last_conforme_reminder_at" TIMESTAMP(3),
    "portal_invitation_status" TEXT NOT NULL DEFAULT 'not_sent',
    "portal_invitation_sent_at" TIMESTAMP(3),
    "portal_invitation_opened_at" TIMESTAMP(3),
    "portal_invitation_expires_at" TIMESTAMP(3),
    "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."inquiry_status_history" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "event_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "transition" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_role" TEXT,
    "actor_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."events" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "walk_in_policy" TEXT NOT NULL DEFAULT 'closed',
    "walk_in_threshold" INTEGER NOT NULL DEFAULT 200,
    "actual_ended_at" TIMESTAMP(3),
    "actual_ended_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "client_portal_status" TEXT NOT NULL DEFAULT 'locked',
    "client_event_day_view_enabled" BOOLEAN NOT NULL DEFAULT false,
    "readiness" TEXT NOT NULL DEFAULT 'Conforme pending',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "archive_override_reason" TEXT,
    "archive_override_by" TEXT,
    "archive_checklist" JSONB NOT NULL DEFAULT '{}',
    "proposal_client_status" TEXT NOT NULL DEFAULT 'pending',
    "proposal_revision_count" INTEGER NOT NULL DEFAULT 0,
    "proposal_reviewed_at" TIMESTAMP(3),
    "proposal_reviewed_by" TEXT,
    "freeze_status" TEXT NOT NULL DEFAULT 'open',
    "freeze_at" TIMESTAMP(3),
    "freeze_deadline_at" TIMESTAMP(3),
    "freeze_reason" TEXT NOT NULL DEFAULT '',
    "floor_plan_status" TEXT NOT NULL DEFAULT 'not_started',
    "floor_plan_id" TEXT,
    "floor_plan_submitted_at" TIMESTAMP(3),
    "floor_plan_reviewed_at" TIMESTAMP(3),
    "floor_plan_projection_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."ocular_visit_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "client_note" TEXT,
    "requested_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "waiver_reason" TEXT,
    "waived_at" TIMESTAMP(3),
    "waived_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocular_visit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."client_floorplan_access_grants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "client_user_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_floorplan_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."event_decisions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_email" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "prior_state" JSONB NOT NULL,
    "financial_impact" JSONB NOT NULL DEFAULT '{}',
    "assignment_impact" JSONB NOT NULL DEFAULT '{}',
    "supplier_impact" TEXT NOT NULL,
    "notification_intent" TEXT NOT NULL DEFAULT 'queued',
    "notification_reason" TEXT,
    "storage_intent" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT,

    CONSTRAINT "event_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."documents" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "generated_file_name" TEXT,
    "validation_status" TEXT NOT NULL DEFAULT 'accepted',
    "rejection_reason" TEXT,
    "storage_bucket" TEXT,
    "storage_key" TEXT,
    "uploaded_by_role" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."briefings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "budget_range" TEXT NOT NULL,
    "service_requirements" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "confirmed_date" TIMESTAMP(3),
    "confirmed_start_time" TEXT,
    "confirmed_end_time" TEXT,
    "program" JSONB NOT NULL DEFAULT '[]',
    "mood_and_styling" TEXT NOT NULL DEFAULT '',
    "styling_budget" INTEGER,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."event_freeze_exceptions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "requested_change" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "decision_note" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "event_freeze_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."addenda" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'issued',
    "document_id" TEXT,
    "document_state" TEXT NOT NULL DEFAULT 'pending',
    "signature_method" TEXT NOT NULL DEFAULT 'scanned_document',
    "contract_snapshot" JSONB NOT NULL,
    "quote_snapshot" JSONB NOT NULL,
    "comparison" JSONB NOT NULL DEFAULT '{}',
    "financial_delta" INTEGER NOT NULL DEFAULT 0,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freeze_exception_id" TEXT,

    CONSTRAINT "addenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."addendum_impacts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "addendum_id" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before_value" JSONB NOT NULL,
    "after_value" JSONB NOT NULL,
    "delta_amount" INTEGER NOT NULL DEFAULT 0,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addendum_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."compliance_rules" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "event_type" TEXT NOT NULL DEFAULT '',
    "phase" TEXT NOT NULL DEFAULT 'planning',
    "severity" TEXT NOT NULL DEFAULT 'must_fix',
    "layer" TEXT NOT NULL DEFAULT 'Must-Fix',
    "condition_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "definition_status" TEXT NOT NULL DEFAULT 'PROVISIONAL',
    "remediation" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."compliance_checks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "rule_id" TEXT,
    "layer" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'must_fix',
    "phase" TEXT NOT NULL DEFAULT 'planning',
    "condition_key" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT NOT NULL DEFAULT '',
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "override_reason" TEXT,
    "override_at" TIMESTAMP(3),
    "override_by" TEXT,
    "run_id" TEXT,
    "evaluation_status" TEXT NOT NULL DEFAULT 'not_satisfied',
    "evidence" JSONB NOT NULL DEFAULT '[]',
    "definition_status" TEXT NOT NULL DEFAULT 'PROVISIONAL',
    "remediation" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."compliance_runs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "rule_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."compliance_risks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "rule_id" TEXT,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "owner" TEXT NOT NULL DEFAULT '',
    "mitigation" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT NOT NULL DEFAULT 'rule',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."compliance_risk_history" (
    "id" TEXT NOT NULL,
    "risk_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "mitigation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_risk_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."post_event_documents" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "client_acknowledged_at" TIMESTAMP(3),
    "acknowledgement_recorded_by" TEXT,
    "acknowledgement_source" TEXT NOT NULL DEFAULT 'pmcm_recorded',
    "client_acknowledgement_note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "post_event_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."event_wrap_ups" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'full',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "activated_at" TIMESTAMP(3) NOT NULL,
    "deadline_at" TIMESTAMP(3) NOT NULL,
    "twelve_hour_reminder_at" TIMESTAMP(3),
    "twenty_four_hour_reminder_at" TIMESTAMP(3),
    "required_items" JSONB NOT NULL DEFAULT '{}',
    "sections" JSONB NOT NULL DEFAULT '{}',
    "client_acknowledged_at" TIMESTAMP(3),
    "acknowledgement_recorded_by" TEXT,
    "acknowledgement_source" TEXT NOT NULL DEFAULT 'pmcm_recorded',
    "client_acknowledgement_note" TEXT NOT NULL DEFAULT '',
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_wrap_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."event_insights" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "highlights" JSONB NOT NULL DEFAULT '[]',
    "risks" JSONB NOT NULL DEFAULT '[]',
    "supplier_notes" JSONB NOT NULL DEFAULT '[]',
    "financial_summary" JSONB NOT NULL DEFAULT '{}',
    "document_summary" JSONB NOT NULL DEFAULT '{}',
    "feedback_summary" JSONB NOT NULL DEFAULT '{}',
    "dimensions" JSONB NOT NULL DEFAULT '{}',
    "private_notes" TEXT NOT NULL DEFAULT '',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiries_status_created_at_idx" ON "event_lifecycle"."inquiries"("status", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_source_created_at_idx" ON "event_lifecycle"."inquiries"("source", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_client_type_created_at_idx" ON "event_lifecycle"."inquiries"("client_type", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_normalized_email_event_date_idx" ON "event_lifecycle"."inquiries"("normalized_email", "event_date");

-- CreateIndex
CREATE INDEX "inquiries_duplicate_of_inquiry_id_idx" ON "event_lifecycle"."inquiries"("duplicate_of_inquiry_id");

-- CreateIndex
CREATE INDEX "inquiries_previous_declined_inquiry_id_idx" ON "event_lifecycle"."inquiries"("previous_declined_inquiry_id");

-- CreateIndex
CREATE INDEX "inquiry_status_history_inquiry_id_created_at_idx" ON "event_lifecycle"."inquiry_status_history"("inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "inquiry_status_history_event_id_created_at_idx" ON "event_lifecycle"."inquiry_status_history"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "events_inquiry_id_idx" ON "event_lifecycle"."events"("inquiry_id");

-- CreateIndex
CREATE INDEX "events_status_event_date_idx" ON "event_lifecycle"."events"("status", "event_date");

-- CreateIndex
CREATE INDEX "events_event_date_id_idx" ON "event_lifecycle"."events"("event_date", "id");

-- CreateIndex
CREATE INDEX "events_active_event_date_idx" ON "event_lifecycle"."events"("event_date", "id") WHERE ("archived" = false);

-- CreateIndex
CREATE UNIQUE INDEX "ocular_visit_requests_event_id_key" ON "event_lifecycle"."ocular_visit_requests"("event_id");

-- CreateIndex
CREATE INDEX "ocular_visit_requests_status_requested_at_idx" ON "event_lifecycle"."ocular_visit_requests"("status", "requested_at");

-- CreateIndex
CREATE INDEX "client_floorplan_access_grants_user_active_idx" ON "event_lifecycle"."client_floorplan_access_grants"("client_user_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "client_floorplan_access_grants_event_user_key" ON "event_lifecycle"."client_floorplan_access_grants"("event_id", "client_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_decisions_idempotency_key_key" ON "event_lifecycle"."event_decisions"("idempotency_key");

-- CreateIndex
CREATE INDEX "event_decisions_event_id_decided_at_idx" ON "event_lifecycle"."event_decisions"("event_id", "decided_at");

-- CreateIndex
CREATE INDEX "documents_event_id_type_idx" ON "event_lifecycle"."documents"("event_id", "type");

-- CreateIndex
CREATE INDEX "briefings_event_id_submitted_at_idx" ON "event_lifecycle"."briefings"("event_id", "submitted_at");

-- CreateIndex
CREATE INDEX "event_freeze_exceptions_event_status_requested_idx" ON "event_lifecycle"."event_freeze_exceptions"("event_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "addenda_event_issued_at_idx" ON "event_lifecycle"."addenda"("event_id", "issued_at");

-- CreateIndex
CREATE UNIQUE INDEX "addenda_event_version_key" ON "event_lifecycle"."addenda"("event_id", "version_number");

-- CreateIndex
CREATE INDEX "addendum_impacts_event_target_idx" ON "event_lifecycle"."addendum_impacts"("event_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "compliance_rules_active_phase_idx" ON "event_lifecycle"."compliance_rules"("active", "phase");

-- CreateIndex
CREATE INDEX "compliance_rules_event_type_phase_idx" ON "event_lifecycle"."compliance_rules"("event_type", "phase");

-- CreateIndex
CREATE INDEX "compliance_rules_event_id_idx" ON "event_lifecycle"."compliance_rules"("event_id");

-- CreateIndex
CREATE INDEX "compliance_checks_event_id_status_idx" ON "event_lifecycle"."compliance_checks"("event_id", "status");

-- CreateIndex
CREATE INDEX "compliance_checks_rule_id_idx" ON "event_lifecycle"."compliance_checks"("rule_id");

-- CreateIndex
CREATE INDEX "compliance_checks_phase_severity_idx" ON "event_lifecycle"."compliance_checks"("phase", "severity");

-- CreateIndex
CREATE INDEX "compliance_checks_run_id_idx" ON "event_lifecycle"."compliance_checks"("run_id");

-- CreateIndex
CREATE INDEX "compliance_runs_event_id_created_at_idx" ON "event_lifecycle"."compliance_runs"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "compliance_runs_event_id_phase_status_idx" ON "event_lifecycle"."compliance_runs"("event_id", "phase", "status");

-- CreateIndex
CREATE INDEX "compliance_risks_event_id_phase_status_idx" ON "event_lifecycle"."compliance_risks"("event_id", "phase", "status");

-- CreateIndex
CREATE INDEX "compliance_risks_rule_id_idx" ON "event_lifecycle"."compliance_risks"("rule_id");

-- CreateIndex
CREATE INDEX "compliance_risk_history_risk_id_created_at_idx" ON "event_lifecycle"."compliance_risk_history"("risk_id", "created_at");

-- CreateIndex
CREATE INDEX "post_event_documents_event_id_status_idx" ON "event_lifecycle"."post_event_documents"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_wrap_ups_event_id_key" ON "event_lifecycle"."event_wrap_ups"("event_id");

-- CreateIndex
CREATE INDEX "event_wrap_ups_deadline_status_idx" ON "event_lifecycle"."event_wrap_ups"("deadline_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "event_insights_event_id_key" ON "event_lifecycle"."event_insights"("event_id");

-- CreateIndex
CREATE INDEX "event_insights_generated_at_idx" ON "event_lifecycle"."event_insights"("generated_at");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."inquiry_status_history" ADD CONSTRAINT "inquiry_status_history_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "event_lifecycle"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."events" ADD CONSTRAINT "events_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "event_lifecycle"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."ocular_visit_requests" ADD CONSTRAINT "ocular_visit_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."client_floorplan_access_grants" ADD CONSTRAINT "client_floorplan_access_grants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."event_decisions" ADD CONSTRAINT "event_decisions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."documents" ADD CONSTRAINT "documents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."briefings" ADD CONSTRAINT "briefings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."event_freeze_exceptions" ADD CONSTRAINT "event_freeze_exceptions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addenda" ADD CONSTRAINT "addenda_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addenda" ADD CONSTRAINT "addenda_freeze_exception_id_fkey" FOREIGN KEY ("freeze_exception_id") REFERENCES "event_lifecycle"."event_freeze_exceptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_impacts" ADD CONSTRAINT "addendum_impacts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."addendum_impacts" ADD CONSTRAINT "addendum_impacts_addendum_id_fkey" FOREIGN KEY ("addendum_id") REFERENCES "event_lifecycle"."addenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_rules" ADD CONSTRAINT "compliance_rules_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_checks" ADD CONSTRAINT "compliance_checks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_checks" ADD CONSTRAINT "compliance_checks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "event_lifecycle"."compliance_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_checks" ADD CONSTRAINT "compliance_checks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "event_lifecycle"."compliance_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_runs" ADD CONSTRAINT "compliance_runs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_risks" ADD CONSTRAINT "compliance_risks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_risks" ADD CONSTRAINT "compliance_risks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "event_lifecycle"."compliance_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."compliance_risk_history" ADD CONSTRAINT "compliance_risk_history_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "event_lifecycle"."compliance_risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."post_event_documents" ADD CONSTRAINT "post_event_documents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."event_wrap_ups" ADD CONSTRAINT "event_wrap_ups_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."event_insights" ADD CONSTRAINT "event_insights_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
