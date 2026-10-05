-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: high

-- Coordinated domain schema cutover. Run only in the approved maintenance window with writers drained,
-- a verified backup, and the matching application artifact. See docs/runbooks/domain-schema-cutover.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- 1. Remove the 45 foreign keys that cross domain boundaries. Columns and indexes stay as scalar references.
ALTER TABLE "event_core"."privacy_requests" DROP CONSTRAINT "privacy_requests_event_id_fkey";
ALTER TABLE "finance_ops"."additional_billings" DROP CONSTRAINT "additional_billings_event_id_fkey";
ALTER TABLE "finance_ops"."billing_corrections" DROP CONSTRAINT "billing_corrections_event_id_fkey";
ALTER TABLE "finance_ops"."billing_disputes" DROP CONSTRAINT "billing_disputes_event_id_fkey";
ALTER TABLE "finance_ops"."billing_sources" DROP CONSTRAINT "billing_sources_event_id_fkey";
ALTER TABLE "finance_ops"."billing_statements" DROP CONSTRAINT "billing_statements_event_id_fkey";
ALTER TABLE "finance_ops"."cost_estimates" DROP CONSTRAINT "cost_estimates_event_id_fkey";
ALTER TABLE "finance_ops"."payment_milestones" DROP CONSTRAINT "payment_milestones_event_id_fkey";
ALTER TABLE "finance_ops"."payment_records" DROP CONSTRAINT "payment_records_event_id_fkey";
ALTER TABLE "finance_ops"."proposal_versions" DROP CONSTRAINT "proposal_versions_event_id_fkey";
ALTER TABLE "floorplan"."floor_plan_drafts" DROP CONSTRAINT "floor_plan_drafts_event_id_fkey";
ALTER TABLE "guest_ops"."check_ins" DROP CONSTRAINT "check_ins_event_id_fkey";
ALTER TABLE "guest_ops"."feedback" DROP CONSTRAINT "feedback_event_id_fkey";
ALTER TABLE "guest_ops"."guest_roster_entries" DROP CONSTRAINT "guest_roster_entries_event_id_fkey";
ALTER TABLE "guest_ops"."guest_roster_imports" DROP CONSTRAINT "guest_roster_imports_event_id_fkey";
ALTER TABLE "guest_ops"."registration_platforms" DROP CONSTRAINT "registration_platforms_event_id_fkey";
ALTER TABLE "identity"."login_history" DROP CONSTRAINT "login_history_user_id_fkey";
ALTER TABLE "identity"."security_alerts" DROP CONSTRAINT "security_alerts_event_id_fkey";
ALTER TABLE "platform_ops"."pare_dispatches" DROP CONSTRAINT "pare_dispatches_event_id_fkey";
ALTER TABLE "platform_ops"."stored_objects" DROP CONSTRAINT "stored_objects_event_id_fkey";
ALTER TABLE "staffing_ops"."coordinator_assignments" DROP CONSTRAINT "coordinator_assignments_event_id_fkey";
ALTER TABLE "staffing_ops"."coordinator_reliability_notes" DROP CONSTRAINT "coordinator_reliability_notes_event_id_fkey";
ALTER TABLE "staffing_ops"."coordinators" DROP CONSTRAINT "coordinators_user_id_fkey";
ALTER TABLE "staffing_ops"."event_coverage_requirements" DROP CONSTRAINT "event_coverage_requirements_event_id_fkey";
ALTER TABLE "staffing_ops"."event_day_logs" DROP CONSTRAINT "event_day_logs_event_id_fkey";
ALTER TABLE "staffing_ops"."event_day_tasks" DROP CONSTRAINT "event_day_tasks_event_id_fkey";
ALTER TABLE "staffing_ops"."event_eod_reports" DROP CONSTRAINT "event_eod_reports_event_id_fkey";
ALTER TABLE "staffing_ops"."event_handoffs" DROP CONSTRAINT "event_handoffs_event_id_fkey";
ALTER TABLE "staffing_ops"."event_operator_designations" DROP CONSTRAINT "event_operator_designations_coordinator_id_fkey";
ALTER TABLE "staffing_ops"."event_operator_designations" DROP CONSTRAINT "event_operator_designations_event_id_fkey";
ALTER TABLE "staffing_ops"."event_schedule_days" DROP CONSTRAINT "event_schedule_days_event_id_fkey";
ALTER TABLE "staffing_ops"."task_reassignment_requests" DROP CONSTRAINT "task_reassignment_requests_event_id_fkey";
ALTER TABLE "staffing_ops"."urgent_issues" DROP CONSTRAINT "urgent_issues_event_id_fkey";
ALTER TABLE "supplier_ops"."communication_threads" DROP CONSTRAINT "communication_threads_event_id_fkey";
ALTER TABLE "supplier_ops"."quote_requests" DROP CONSTRAINT "quote_requests_contract_document_id_fkey";
ALTER TABLE "supplier_ops"."quote_requests" DROP CONSTRAINT "quote_requests_event_id_fkey";
ALTER TABLE "supplier_ops"."quote_rounds" DROP CONSTRAINT "quote_rounds_event_id_fkey";
ALTER TABLE "supplier_ops"."quotes" DROP CONSTRAINT "quotes_event_id_fkey";
ALTER TABLE "supplier_ops"."supplier_reliability_notes" DROP CONSTRAINT "supplier_reliability_notes_event_id_fkey";
ALTER TABLE "supplier_ops"."supplier_reviews" DROP CONSTRAINT "supplier_reviews_event_id_fkey";
ALTER TABLE "supplier_ops"."supplier_schedules" DROP CONSTRAINT "supplier_schedules_event_id_fkey";
ALTER TABLE "trust_ops"."ai_approval_records" DROP CONSTRAINT "ai_approval_records_event_id_fkey";
ALTER TABLE "trust_ops"."ai_audit_logs" DROP CONSTRAINT "ai_audit_logs_event_id_fkey";
ALTER TABLE "trust_ops"."audit_logs" DROP CONSTRAINT "audit_logs_event_id_fkey";
ALTER TABLE "trust_ops"."notification_logs" DROP CONSTRAINT "notification_logs_event_id_fkey";

-- 2. Create the owner schemas.
CREATE SCHEMA IF NOT EXISTS "commercial";
CREATE SCHEMA IF NOT EXISTS "event_lifecycle";
CREATE SCHEMA IF NOT EXISTS "floorplan";
CREATE SCHEMA IF NOT EXISTS "identity_access";
CREATE SCHEMA IF NOT EXISTS "live_ops";
CREATE SCHEMA IF NOT EXISTS "operations";
CREATE SCHEMA IF NOT EXISTS "platform_ops";

-- 3. Move 83 tables into their owner schemas. SET SCHEMA keeps each table OID, rows, indexes, constraints and sequences.

-- commercial
ALTER TABLE "finance_ops"."additional_billings" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."billing_corrections" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."billing_disputes" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."billing_sources" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."billing_statement_sequences" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."billing_statements" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."communication_messages" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."communication_participants" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."communication_threads" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."cost_estimate_lines" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."cost_estimates" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."payment_milestones" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."payment_records" SET SCHEMA "commercial";
ALTER TABLE "finance_ops"."proposal_versions" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."quote_requests" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."quote_rounds" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."quotes" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_applications" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_availability" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_categories" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_certifications" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_promotions" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_reliability_notes" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_review_dimension_ratings" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_review_dimensions" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_reviews" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."supplier_schedules" SET SCHEMA "commercial";
ALTER TABLE "supplier_ops"."suppliers" SET SCHEMA "commercial";

-- event_lifecycle
ALTER TABLE "event_core"."addenda" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."addendum_impacts" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."briefings" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."compliance_checks" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."compliance_risk_history" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."compliance_risks" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."compliance_rules" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."compliance_runs" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."documents" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."event_decisions" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."event_freeze_exceptions" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."event_insights" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."event_wrap_ups" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."events" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."inquiries" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."inquiry_status_history" SET SCHEMA "event_lifecycle";
ALTER TABLE "event_core"."ocular_visit_requests" SET SCHEMA "event_lifecycle";
ALTER TABLE "compliance_ops"."post_event_documents" SET SCHEMA "event_lifecycle";

-- identity_access
ALTER TABLE "identity"."approval_requests" SET SCHEMA "identity_access";
ALTER TABLE "identity"."password_reset_rate_limits" SET SCHEMA "identity_access";
ALTER TABLE "identity"."password_reset_tokens" SET SCHEMA "identity_access";
ALTER TABLE "identity"."users" SET SCHEMA "identity_access";

-- live_ops
ALTER TABLE "staffing_ops"."event_day_logs" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."event_day_tasks" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."event_eod_replies" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."event_eod_reports" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."event_handoffs" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."event_operator_designations" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."event_schedule_days" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."event_schedule_segments" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."task_reassignment_requests" SET SCHEMA "live_ops";
ALTER TABLE "staffing_ops"."urgent_issues" SET SCHEMA "live_ops";

-- operations
ALTER TABLE "guest_ops"."check_ins" SET SCHEMA "operations";
ALTER TABLE "staffing_ops"."coordinator_assignment_acknowledgments" SET SCHEMA "operations";
ALTER TABLE "staffing_ops"."coordinator_assignments" SET SCHEMA "operations";
ALTER TABLE "staffing_ops"."coordinator_availability" SET SCHEMA "operations";
ALTER TABLE "staffing_ops"."coordinator_reliability_notes" SET SCHEMA "operations";
ALTER TABLE "staffing_ops"."coordinators" SET SCHEMA "operations";
ALTER TABLE "staffing_ops"."event_coverage_requirements" SET SCHEMA "operations";
ALTER TABLE "guest_ops"."feedback" SET SCHEMA "operations";
ALTER TABLE "guest_ops"."feedback_media" SET SCHEMA "operations";
ALTER TABLE "guest_ops"."guest_roster_entries" SET SCHEMA "operations";
ALTER TABLE "guest_ops"."guest_roster_imports" SET SCHEMA "operations";
ALTER TABLE "guest_ops"."registration_platforms" SET SCHEMA "operations";

-- platform_ops
ALTER TABLE "trust_ops"."ai_approval_records" SET SCHEMA "platform_ops";
ALTER TABLE "trust_ops"."ai_audit_logs" SET SCHEMA "platform_ops";
ALTER TABLE "trust_ops"."ai_daily_token_usage" SET SCHEMA "platform_ops";
ALTER TABLE "trust_ops"."audit_chain_locks" SET SCHEMA "platform_ops";
ALTER TABLE "trust_ops"."audit_logs" SET SCHEMA "platform_ops";
ALTER TABLE "trust_ops"."command_receipts" SET SCHEMA "platform_ops";
ALTER TABLE "trust_ops"."conforme_comms_drafts" SET SCHEMA "platform_ops";
ALTER TABLE "identity"."login_history" SET SCHEMA "platform_ops";
ALTER TABLE "trust_ops"."notification_logs" SET SCHEMA "platform_ops";
ALTER TABLE "event_core"."privacy_requests" SET SCHEMA "platform_ops";
ALTER TABLE "identity"."security_alerts" SET SCHEMA "platform_ops";

-- 4. Retire the old schemas. DROP SCHEMA without CASCADE fails if anything unexpected remains.
DROP SCHEMA "compliance_ops";
DROP SCHEMA "event_core";
DROP SCHEMA "finance_ops";
DROP SCHEMA "guest_ops";
DROP SCHEMA "identity";
DROP SCHEMA "staffing_ops";
DROP SCHEMA "supplier_ops";
DROP SCHEMA "trust_ops";
COMMIT;
