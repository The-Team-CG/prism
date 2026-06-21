CREATE SCHEMA IF NOT EXISTS floorplan;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS event_core;
CREATE SCHEMA IF NOT EXISTS supplier_ops;
CREATE SCHEMA IF NOT EXISTS staffing_ops;
CREATE SCHEMA IF NOT EXISTS finance_ops;
CREATE SCHEMA IF NOT EXISTS compliance_ops;
CREATE SCHEMA IF NOT EXISTS guest_ops;
CREATE SCHEMA IF NOT EXISTS trust_ops;

ALTER TABLE IF EXISTS public.floor_plans SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.floor_plan_objects SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.venue_templates SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.event_instances SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.published_snapshots SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.ops_floor_plan_drafts SET SCHEMA floorplan;

ALTER TABLE IF EXISTS public.ops_users SET SCHEMA identity;
ALTER TABLE IF EXISTS public.ops_approval_requests SET SCHEMA identity;
ALTER TABLE IF EXISTS public.ops_login_history SET SCHEMA identity;
ALTER TABLE IF EXISTS public.ops_security_alerts SET SCHEMA identity;

ALTER TABLE IF EXISTS public.ops_inquiries SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_events SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_privacy_requests SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_documents SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_briefings SET SCHEMA event_core;

ALTER TABLE IF EXISTS public.ops_supplier_categories SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_suppliers SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_reviews SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_reliability_notes SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_certifications SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_quote_requests SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_quotes SET SCHEMA supplier_ops;

ALTER TABLE IF EXISTS public.ops_coordinators SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_coordinator_assignments SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_event_day_tasks SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_urgent_issues SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_event_day_logs SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_coordinator_reliability_notes SET SCHEMA staffing_ops;

ALTER TABLE IF EXISTS public.ops_billing_sources SET SCHEMA finance_ops;
ALTER TABLE IF EXISTS public.ops_billing_statements SET SCHEMA finance_ops;
ALTER TABLE IF EXISTS public.ops_payment_milestones SET SCHEMA finance_ops;
ALTER TABLE IF EXISTS public.ops_payment_records SET SCHEMA finance_ops;

ALTER TABLE IF EXISTS public.ops_compliance_rules SET SCHEMA compliance_ops;
ALTER TABLE IF EXISTS public.ops_compliance_checks SET SCHEMA compliance_ops;
ALTER TABLE IF EXISTS public.ops_post_event_documents SET SCHEMA compliance_ops;
ALTER TABLE IF EXISTS public.ops_event_insights SET SCHEMA compliance_ops;

ALTER TABLE IF EXISTS public.ops_guest_check_ins SET SCHEMA guest_ops;
ALTER TABLE IF EXISTS public.ops_guest_feedback SET SCHEMA guest_ops;

ALTER TABLE IF EXISTS public.ops_audit_logs SET SCHEMA trust_ops;
ALTER TABLE IF EXISTS public.ops_notification_logs SET SCHEMA trust_ops;
ALTER TABLE IF EXISTS public.ops_ai_audit_logs SET SCHEMA trust_ops;
ALTER TABLE IF EXISTS public.ops_ai_approval_records SET SCHEMA trust_ops;