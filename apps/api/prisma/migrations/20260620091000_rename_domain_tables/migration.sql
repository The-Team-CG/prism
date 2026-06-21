ALTER TABLE IF EXISTS floorplan.ops_floor_plan_drafts RENAME TO floor_plan_drafts;

ALTER TABLE IF EXISTS identity.ops_users RENAME TO users;
ALTER TABLE IF EXISTS identity.ops_approval_requests RENAME TO approval_requests;
ALTER TABLE IF EXISTS identity.ops_login_history RENAME TO login_history;
ALTER TABLE IF EXISTS identity.ops_security_alerts RENAME TO security_alerts;

ALTER TABLE IF EXISTS event_core.ops_inquiries RENAME TO inquiries;
ALTER TABLE IF EXISTS event_core.ops_events RENAME TO events;
ALTER TABLE IF EXISTS event_core.ops_privacy_requests RENAME TO privacy_requests;
ALTER TABLE IF EXISTS event_core.ops_documents RENAME TO documents;
ALTER TABLE IF EXISTS event_core.ops_briefings RENAME TO briefings;

ALTER TABLE IF EXISTS supplier_ops.ops_supplier_categories RENAME TO supplier_categories;
ALTER TABLE IF EXISTS supplier_ops.ops_suppliers RENAME TO suppliers;
ALTER TABLE IF EXISTS supplier_ops.ops_supplier_reviews RENAME TO supplier_reviews;
ALTER TABLE IF EXISTS supplier_ops.ops_supplier_reliability_notes RENAME TO supplier_reliability_notes;
ALTER TABLE IF EXISTS supplier_ops.ops_supplier_certifications RENAME TO supplier_certifications;
ALTER TABLE IF EXISTS supplier_ops.ops_supplier_quote_requests RENAME TO quote_requests;
ALTER TABLE IF EXISTS supplier_ops.ops_supplier_quotes RENAME TO quotes;

ALTER TABLE IF EXISTS staffing_ops.ops_coordinators RENAME TO coordinators;
ALTER TABLE IF EXISTS staffing_ops.ops_coordinator_assignments RENAME TO coordinator_assignments;
ALTER TABLE IF EXISTS staffing_ops.ops_event_day_tasks RENAME TO event_day_tasks;
ALTER TABLE IF EXISTS staffing_ops.ops_urgent_issues RENAME TO urgent_issues;
ALTER TABLE IF EXISTS staffing_ops.ops_event_day_logs RENAME TO event_day_logs;
ALTER TABLE IF EXISTS staffing_ops.ops_coordinator_reliability_notes RENAME TO coordinator_reliability_notes;

ALTER TABLE IF EXISTS finance_ops.ops_billing_sources RENAME TO billing_sources;
ALTER TABLE IF EXISTS finance_ops.ops_billing_statements RENAME TO billing_statements;
ALTER TABLE IF EXISTS finance_ops.ops_payment_milestones RENAME TO payment_milestones;
ALTER TABLE IF EXISTS finance_ops.ops_payment_records RENAME TO payment_records;

ALTER TABLE IF EXISTS compliance_ops.ops_compliance_rules RENAME TO compliance_rules;
ALTER TABLE IF EXISTS compliance_ops.ops_compliance_checks RENAME TO compliance_checks;
ALTER TABLE IF EXISTS compliance_ops.ops_post_event_documents RENAME TO post_event_documents;
ALTER TABLE IF EXISTS compliance_ops.ops_event_insights RENAME TO event_insights;

ALTER TABLE IF EXISTS guest_ops.ops_guest_check_ins RENAME TO check_ins;
ALTER TABLE IF EXISTS guest_ops.ops_guest_feedback RENAME TO feedback;

ALTER TABLE IF EXISTS trust_ops.ops_audit_logs RENAME TO audit_logs;
ALTER TABLE IF EXISTS trust_ops.ops_notification_logs RENAME TO notification_logs;
ALTER TABLE IF EXISTS trust_ops.ops_ai_audit_logs RENAME TO ai_audit_logs;
ALTER TABLE IF EXISTS trust_ops.ops_ai_approval_records RENAME TO ai_approval_records;
DO $$
DECLARE
  item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ARRAY['identity', 'ops_approval_requests_status_requested_at_idx', 'approval_requests_status_requested_at_idx'],
    ARRAY['event_core', 'ops_inquiries_status_created_at_idx', 'inquiries_status_created_at_idx'],
    ARRAY['event_core', 'ops_inquiries_source_created_at_idx', 'inquiries_source_created_at_idx'],
    ARRAY['event_core', 'ops_inquiries_client_type_created_at_idx', 'inquiries_client_type_created_at_idx'],
    ARRAY['event_core', 'ops_inquiries_normalized_email_event_date_idx', 'inquiries_normalized_email_event_date_idx'],
    ARRAY['event_core', 'ops_inquiries_duplicate_of_inquiry_id_idx', 'inquiries_duplicate_of_inquiry_id_idx'],
    ARRAY['event_core', 'ops_inquiries_previous_declined_inquiry_id_idx', 'inquiries_previous_declined_inquiry_id_idx'],
    ARRAY['event_core', 'ops_events_status_event_date_idx', 'events_status_event_date_idx'],
    ARRAY['event_core', 'ops_privacy_requests_status_created_at_idx', 'privacy_requests_status_created_at_idx'],
    ARRAY['event_core', 'ops_privacy_requests_subject_email_idx', 'privacy_requests_subject_email_idx'],
    ARRAY['event_core', 'ops_privacy_requests_event_id_idx', 'privacy_requests_event_id_idx'],
    ARRAY['floorplan', 'ops_floor_plan_drafts_event_id_status_idx', 'floor_plan_drafts_event_id_status_idx'],
    ARRAY['floorplan', 'ops_floor_plan_drafts_event_id_is_active_idx', 'floor_plan_drafts_event_id_is_active_idx'],
    ARRAY['event_core', 'ops_documents_event_id_type_idx', 'documents_event_id_type_idx'],
    ARRAY['event_core', 'ops_briefings_event_id_submitted_at_idx', 'briefings_event_id_submitted_at_idx'],
    ARRAY['supplier_ops', 'ops_supplier_quote_requests_event_id_status_idx', 'quote_requests_event_id_status_idx'],
    ARRAY['supplier_ops', 'ops_supplier_quote_requests_supplier_id_idx', 'quote_requests_supplier_id_idx'],
    ARRAY['supplier_ops', 'ops_supplier_quote_requests_category_id_idx', 'quote_requests_category_id_idx'],
    ARRAY['supplier_ops', 'ops_supplier_quotes_event_id_status_idx', 'quotes_event_id_status_idx'],
    ARRAY['supplier_ops', 'ops_supplier_quotes_supplier_id_idx', 'quotes_supplier_id_idx'],
    ARRAY['supplier_ops', 'ops_supplier_quotes_category_id_idx', 'quotes_category_id_idx'],
    ARRAY['supplier_ops', 'ops_supplier_categories_active_sort_order_idx', 'supplier_categories_active_sort_order_idx'],
    ARRAY['supplier_ops', 'ops_suppliers_category_id_tier_idx', 'suppliers_category_id_tier_idx'],
    ARRAY['supplier_ops', 'ops_suppliers_bni_member_idx', 'suppliers_bni_member_idx'],
    ARRAY['supplier_ops', 'ops_supplier_reviews_supplier_id_created_at_idx', 'supplier_reviews_supplier_id_created_at_idx'],
    ARRAY['supplier_ops', 'ops_supplier_reviews_event_id_idx', 'supplier_reviews_event_id_idx'],
    ARRAY['supplier_ops', 'ops_supplier_reliability_notes_supplier_id_created_at_idx', 'supplier_reliability_notes_supplier_id_created_at_idx'],
    ARRAY['supplier_ops', 'ops_supplier_reliability_notes_event_id_idx', 'supplier_reliability_notes_event_id_idx'],
    ARRAY['supplier_ops', 'ops_supplier_certifications_supplier_id_uploaded_at_idx', 'supplier_certifications_supplier_id_uploaded_at_idx'],
    ARRAY['staffing_ops', 'ops_coordinators_active_name_idx', 'coordinators_active_name_idx'],
    ARRAY['staffing_ops', 'ops_coordinator_assignments_event_id_status_idx', 'coordinator_assignments_event_id_status_idx'],
    ARRAY['staffing_ops', 'ops_coordinator_assignments_coordinator_id_event_date_idx', 'coordinator_assignments_coordinator_id_event_date_idx'],
    ARRAY['staffing_ops', 'ops_coordinator_assignments_event_id_attendance_status_idx', 'coordinator_assignments_event_id_attendance_status_idx'],
    ARRAY['staffing_ops', 'ops_event_day_tasks_event_id_status_idx', 'event_day_tasks_event_id_status_idx'],
    ARRAY['staffing_ops', 'ops_event_day_tasks_event_id_assigned_role_idx', 'event_day_tasks_event_id_assigned_role_idx'],
    ARRAY['staffing_ops', 'ops_event_day_tasks_event_id_sla_status_idx', 'event_day_tasks_event_id_sla_status_idx'],
    ARRAY['staffing_ops', 'ops_urgent_issues_event_id_status_idx', 'urgent_issues_event_id_status_idx'],
    ARRAY['staffing_ops', 'ops_urgent_issues_event_id_severity_idx', 'urgent_issues_event_id_severity_idx'],
    ARRAY['staffing_ops', 'ops_urgent_issues_event_id_sla_status_idx', 'urgent_issues_event_id_sla_status_idx'],
    ARRAY['staffing_ops', 'ops_event_day_logs_event_id_created_at_idx', 'event_day_logs_event_id_created_at_idx'],
    ARRAY['staffing_ops', 'ops_event_day_logs_event_id_action_type_idx', 'event_day_logs_event_id_action_type_idx'],
    ARRAY['staffing_ops', 'ops_coord_reliability_notes_event_id_created_at_idx', 'coordinator_reliability_notes_event_id_created_at_idx'],
    ARRAY['staffing_ops', 'ops_coord_reliability_notes_coordinator_id_created_at_idx', 'coordinator_reliability_notes_coordinator_id_created_at_idx'],
    ARRAY['compliance_ops', 'ops_compliance_rules_active_phase_idx', 'compliance_rules_active_phase_idx'],
    ARRAY['compliance_ops', 'ops_compliance_rules_event_type_phase_idx', 'compliance_rules_event_type_phase_idx'],
    ARRAY['compliance_ops', 'ops_compliance_rules_event_id_idx', 'compliance_rules_event_id_idx'],
    ARRAY['compliance_ops', 'ops_compliance_checks_event_id_status_idx', 'compliance_checks_event_id_status_idx'],
    ARRAY['compliance_ops', 'ops_compliance_checks_rule_id_idx', 'compliance_checks_rule_id_idx'],
    ARRAY['compliance_ops', 'ops_compliance_checks_phase_severity_idx', 'compliance_checks_phase_severity_idx'],
    ARRAY['finance_ops', 'ops_billing_sources_event_id_status_idx', 'billing_sources_event_id_status_idx'],
    ARRAY['finance_ops', 'ops_billing_statements_event_id_generated_at_idx', 'billing_statements_event_id_generated_at_idx'],
    ARRAY['finance_ops', 'ops_billing_statements_source_id_idx', 'billing_statements_source_id_idx'],
    ARRAY['finance_ops', 'ops_payment_milestones_event_id_status_idx', 'payment_milestones_event_id_status_idx'],
    ARRAY['finance_ops', 'ops_payment_records_event_id_recorded_at_idx', 'payment_records_event_id_recorded_at_idx'],
    ARRAY['finance_ops', 'ops_payment_records_milestone_id_recorded_at_idx', 'payment_records_milestone_id_recorded_at_idx'],
    ARRAY['compliance_ops', 'ops_post_event_documents_event_id_status_idx', 'post_event_documents_event_id_status_idx'],
    ARRAY['compliance_ops', 'ops_event_insights_generated_at_idx', 'event_insights_generated_at_idx'],
    ARRAY['trust_ops', 'ops_audit_logs_event_id_created_at_idx', 'audit_logs_event_id_created_at_idx'],
    ARRAY['trust_ops', 'ops_audit_logs_actor_created_at_idx', 'audit_logs_actor_created_at_idx'],
    ARRAY['trust_ops', 'ops_audit_logs_category_created_at_idx', 'audit_logs_category_created_at_idx'],
    ARRAY['trust_ops', 'ops_audit_logs_action_type_created_at_idx', 'audit_logs_action_type_created_at_idx'],
    ARRAY['trust_ops', 'ops_audit_logs_severity_created_at_idx', 'audit_logs_severity_created_at_idx'],
    ARRAY['trust_ops', 'ops_notification_logs_event_id_created_at_idx', 'notification_logs_event_id_created_at_idx'],
    ARRAY['trust_ops', 'ops_notification_logs_status_created_at_idx', 'notification_logs_status_created_at_idx'],
    ARRAY['trust_ops', 'ops_notification_logs_correlation_id_idx', 'notification_logs_correlation_id_idx'],
    ARRAY['guest_ops', 'ops_guest_check_ins_event_id_checked_in_at_idx', 'check_ins_event_id_checked_in_at_idx'],
    ARRAY['guest_ops', 'ops_guest_check_ins_event_id_guest_name_idx', 'check_ins_event_id_guest_name_idx'],
    ARRAY['guest_ops', 'ops_guest_feedback_event_id_moderation_status_idx', 'feedback_event_id_moderation_status_idx'],
    ARRAY['trust_ops', 'ops_ai_audit_logs_feature_name_created_at_idx', 'ai_audit_logs_feature_name_created_at_idx'],
    ARRAY['trust_ops', 'ops_ai_audit_logs_status_created_at_idx', 'ai_audit_logs_status_created_at_idx'],
    ARRAY['trust_ops', 'ops_ai_approval_records_ai_audit_log_id_idx', 'ai_approval_records_ai_audit_log_id_idx'],
    ARRAY['trust_ops', 'ops_ai_approval_records_status_requested_at_idx', 'ai_approval_records_status_requested_at_idx'],
    ARRAY['identity', 'ops_login_history_user_id_created_at_idx', 'login_history_user_id_created_at_idx'],
    ARRAY['identity', 'ops_login_history_email_created_at_idx', 'login_history_email_created_at_idx'],
    ARRAY['identity', 'ops_login_history_status_created_at_idx', 'login_history_status_created_at_idx'],
    ARRAY['identity', 'ops_security_alerts_status_created_at_idx', 'security_alerts_status_created_at_idx'],
    ARRAY['identity', 'ops_security_alerts_type_created_at_idx', 'security_alerts_type_created_at_idx'],
    ARRAY['identity', 'ops_security_alerts_severity_created_at_idx', 'security_alerts_severity_created_at_idx']
  ] LOOP
    IF to_regclass(format('%I.%I', item[1], item[2])) IS NOT NULL
       AND to_regclass(format('%I.%I', item[1], item[3])) IS NULL THEN
      EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', item[1], item[2], item[3]);
    END IF;
  END LOOP;

  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ARRAY['trust_ops', 'ai_approval_records', 'ops_ai_approval_records_event_id_fkey', 'ai_approval_records_event_id_fkey'],
    ARRAY['trust_ops', 'ai_approval_records', 'ops_ai_approval_records_pkey', 'ai_approval_records_pkey'],
    ARRAY['trust_ops', 'ai_audit_logs', 'ops_ai_audit_logs_event_id_fkey', 'ai_audit_logs_event_id_fkey'],
    ARRAY['trust_ops', 'ai_audit_logs', 'ops_ai_audit_logs_pkey', 'ai_audit_logs_pkey'],
    ARRAY['identity', 'approval_requests', 'ops_approval_requests_pkey', 'approval_requests_pkey'],
    ARRAY['trust_ops', 'audit_logs', 'ops_audit_logs_event_id_fkey', 'audit_logs_event_id_fkey'],
    ARRAY['trust_ops', 'audit_logs', 'ops_audit_logs_pkey', 'audit_logs_pkey'],
    ARRAY['finance_ops', 'billing_sources', 'ops_billing_sources_event_id_fkey', 'billing_sources_event_id_fkey'],
    ARRAY['finance_ops', 'billing_sources', 'ops_billing_sources_pkey', 'billing_sources_pkey'],
    ARRAY['finance_ops', 'billing_statements', 'ops_billing_statements_event_id_fkey', 'billing_statements_event_id_fkey'],
    ARRAY['finance_ops', 'billing_statements', 'ops_billing_statements_pkey', 'billing_statements_pkey'],
    ARRAY['finance_ops', 'billing_statements', 'ops_billing_statements_source_id_fkey', 'billing_statements_source_id_fkey'],
    ARRAY['event_core', 'briefings', 'ops_briefings_event_id_fkey', 'briefings_event_id_fkey'],
    ARRAY['event_core', 'briefings', 'ops_briefings_pkey', 'briefings_pkey'],
    ARRAY['compliance_ops', 'compliance_checks', 'ops_compliance_checks_event_id_fkey', 'compliance_checks_event_id_fkey'],
    ARRAY['compliance_ops', 'compliance_checks', 'ops_compliance_checks_pkey', 'compliance_checks_pkey'],
    ARRAY['compliance_ops', 'compliance_checks', 'ops_compliance_checks_rule_id_fkey', 'compliance_checks_rule_id_fkey'],
    ARRAY['compliance_ops', 'compliance_rules', 'ops_compliance_rules_event_id_fkey', 'compliance_rules_event_id_fkey'],
    ARRAY['compliance_ops', 'compliance_rules', 'ops_compliance_rules_pkey', 'compliance_rules_pkey'],
    ARRAY['staffing_ops', 'coordinator_assignments', 'ops_coordinator_assignments_coordinator_id_fkey', 'coordinator_assignments_coordinator_id_fkey'],
    ARRAY['staffing_ops', 'coordinator_assignments', 'ops_coordinator_assignments_event_id_fkey', 'coordinator_assignments_event_id_fkey'],
    ARRAY['staffing_ops', 'coordinator_assignments', 'ops_coordinator_assignments_pkey', 'coordinator_assignments_pkey'],
    ARRAY['staffing_ops', 'coordinator_reliability_notes', 'ops_coordinator_reliability_notes_assignment_id_fkey', 'coordinator_reliability_notes_assignment_id_fkey'],
    ARRAY['staffing_ops', 'coordinator_reliability_notes', 'ops_coordinator_reliability_notes_coordinator_id_fkey', 'coordinator_reliability_notes_coordinator_id_fkey'],
    ARRAY['staffing_ops', 'coordinator_reliability_notes', 'ops_coordinator_reliability_notes_event_id_fkey', 'coordinator_reliability_notes_event_id_fkey'],
    ARRAY['staffing_ops', 'coordinator_reliability_notes', 'ops_coordinator_reliability_notes_pkey', 'coordinator_reliability_notes_pkey'],
    ARRAY['staffing_ops', 'coordinators', 'ops_coordinators_pkey', 'coordinators_pkey'],
    ARRAY['staffing_ops', 'coordinators', 'ops_coordinators_user_id_fkey', 'coordinators_user_id_fkey'],
    ARRAY['event_core', 'documents', 'ops_documents_event_id_fkey', 'documents_event_id_fkey'],
    ARRAY['event_core', 'documents', 'ops_documents_pkey', 'documents_pkey'],
    ARRAY['staffing_ops', 'event_day_logs', 'ops_event_day_logs_event_id_fkey', 'event_day_logs_event_id_fkey'],
    ARRAY['staffing_ops', 'event_day_logs', 'ops_event_day_logs_pkey', 'event_day_logs_pkey'],
    ARRAY['staffing_ops', 'event_day_tasks', 'ops_event_day_tasks_event_id_fkey', 'event_day_tasks_event_id_fkey'],
    ARRAY['staffing_ops', 'event_day_tasks', 'ops_event_day_tasks_pkey', 'event_day_tasks_pkey'],
    ARRAY['compliance_ops', 'event_insights', 'ops_event_insights_event_id_fkey', 'event_insights_event_id_fkey'],
    ARRAY['compliance_ops', 'event_insights', 'ops_event_insights_pkey', 'event_insights_pkey'],
    ARRAY['event_core', 'events', 'ops_events_inquiry_id_fkey', 'events_inquiry_id_fkey'],
    ARRAY['event_core', 'events', 'ops_events_pkey', 'events_pkey'],
    ARRAY['floorplan', 'floor_plan_drafts', 'ops_floor_plan_drafts_event_id_fkey', 'floor_plan_drafts_event_id_fkey'],
    ARRAY['floorplan', 'floor_plan_drafts', 'ops_floor_plan_drafts_floor_plan_id_fkey', 'floor_plan_drafts_floor_plan_id_fkey'],
    ARRAY['floorplan', 'floor_plan_drafts', 'ops_floor_plan_drafts_pkey', 'floor_plan_drafts_pkey'],
    ARRAY['guest_ops', 'check_ins', 'ops_guest_check_ins_event_id_fkey', 'check_ins_event_id_fkey'],
    ARRAY['guest_ops', 'check_ins', 'ops_guest_check_ins_pkey', 'check_ins_pkey'],
    ARRAY['guest_ops', 'feedback', 'ops_guest_feedback_event_id_fkey', 'feedback_event_id_fkey'],
    ARRAY['guest_ops', 'feedback', 'ops_guest_feedback_pkey', 'feedback_pkey'],
    ARRAY['event_core', 'inquiries', 'ops_inquiries_pkey', 'inquiries_pkey'],
    ARRAY['identity', 'login_history', 'ops_login_history_pkey', 'login_history_pkey'],
    ARRAY['identity', 'login_history', 'ops_login_history_user_id_fkey', 'login_history_user_id_fkey'],
    ARRAY['trust_ops', 'notification_logs', 'ops_notification_logs_event_id_fkey', 'notification_logs_event_id_fkey'],
    ARRAY['trust_ops', 'notification_logs', 'ops_notification_logs_pkey', 'notification_logs_pkey'],
    ARRAY['finance_ops', 'payment_milestones', 'ops_payment_milestones_event_id_fkey', 'payment_milestones_event_id_fkey'],
    ARRAY['finance_ops', 'payment_milestones', 'ops_payment_milestones_pkey', 'payment_milestones_pkey'],
    ARRAY['finance_ops', 'payment_records', 'ops_payment_records_event_id_fkey', 'payment_records_event_id_fkey'],
    ARRAY['finance_ops', 'payment_records', 'ops_payment_records_milestone_id_fkey', 'payment_records_milestone_id_fkey'],
    ARRAY['finance_ops', 'payment_records', 'ops_payment_records_pkey', 'payment_records_pkey'],
    ARRAY['compliance_ops', 'post_event_documents', 'ops_post_event_documents_event_id_fkey', 'post_event_documents_event_id_fkey'],
    ARRAY['compliance_ops', 'post_event_documents', 'ops_post_event_documents_pkey', 'post_event_documents_pkey'],
    ARRAY['event_core', 'privacy_requests', 'ops_privacy_requests_event_id_fkey', 'privacy_requests_event_id_fkey'],
    ARRAY['event_core', 'privacy_requests', 'ops_privacy_requests_pkey', 'privacy_requests_pkey'],
    ARRAY['identity', 'security_alerts', 'ops_security_alerts_event_id_fkey', 'security_alerts_event_id_fkey'],
    ARRAY['identity', 'security_alerts', 'ops_security_alerts_pkey', 'security_alerts_pkey'],
    ARRAY['supplier_ops', 'supplier_categories', 'ops_supplier_categories_pkey', 'supplier_categories_pkey'],
    ARRAY['supplier_ops', 'supplier_certifications', 'ops_supplier_certifications_pkey', 'supplier_certifications_pkey'],
    ARRAY['supplier_ops', 'supplier_certifications', 'ops_supplier_certifications_supplier_id_fkey', 'supplier_certifications_supplier_id_fkey'],
    ARRAY['supplier_ops', 'quote_requests', 'ops_supplier_quote_requests_category_id_fkey', 'quote_requests_category_id_fkey'],
    ARRAY['supplier_ops', 'quote_requests', 'ops_supplier_quote_requests_contract_document_id_fkey', 'quote_requests_contract_document_id_fkey'],
    ARRAY['supplier_ops', 'quote_requests', 'ops_supplier_quote_requests_event_id_fkey', 'quote_requests_event_id_fkey'],
    ARRAY['supplier_ops', 'quote_requests', 'ops_supplier_quote_requests_pkey', 'quote_requests_pkey'],
    ARRAY['supplier_ops', 'quote_requests', 'ops_supplier_quote_requests_supplier_id_fkey', 'quote_requests_supplier_id_fkey'],
    ARRAY['supplier_ops', 'quotes', 'ops_supplier_quotes_category_id_fkey', 'quotes_category_id_fkey'],
    ARRAY['supplier_ops', 'quotes', 'ops_supplier_quotes_event_id_fkey', 'quotes_event_id_fkey'],
    ARRAY['supplier_ops', 'quotes', 'ops_supplier_quotes_pkey', 'quotes_pkey'],
    ARRAY['supplier_ops', 'quotes', 'ops_supplier_quotes_supplier_id_fkey', 'quotes_supplier_id_fkey'],
    ARRAY['supplier_ops', 'supplier_reliability_notes', 'ops_supplier_reliability_notes_event_id_fkey', 'supplier_reliability_notes_event_id_fkey'],
    ARRAY['supplier_ops', 'supplier_reliability_notes', 'ops_supplier_reliability_notes_pkey', 'supplier_reliability_notes_pkey'],
    ARRAY['supplier_ops', 'supplier_reliability_notes', 'ops_supplier_reliability_notes_supplier_id_fkey', 'supplier_reliability_notes_supplier_id_fkey'],
    ARRAY['supplier_ops', 'supplier_reviews', 'ops_supplier_reviews_event_id_fkey', 'supplier_reviews_event_id_fkey'],
    ARRAY['supplier_ops', 'supplier_reviews', 'ops_supplier_reviews_pkey', 'supplier_reviews_pkey'],
    ARRAY['supplier_ops', 'supplier_reviews', 'ops_supplier_reviews_supplier_id_fkey', 'supplier_reviews_supplier_id_fkey'],
    ARRAY['supplier_ops', 'suppliers', 'ops_suppliers_category_id_fkey', 'suppliers_category_id_fkey'],
    ARRAY['supplier_ops', 'suppliers', 'ops_suppliers_pkey', 'suppliers_pkey'],
    ARRAY['staffing_ops', 'urgent_issues', 'ops_urgent_issues_event_id_fkey', 'urgent_issues_event_id_fkey'],
    ARRAY['staffing_ops', 'urgent_issues', 'ops_urgent_issues_pkey', 'urgent_issues_pkey'],
    ARRAY['identity', 'users', 'ops_users_pkey', 'users_pkey']
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = item[1]
        AND t.relname = item[2]
        AND c.conname = item[3]
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = item[1]
        AND t.relname = item[2]
        AND c.conname = item[4]
    ) THEN
      EXECUTE format('ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I', item[1], item[2], item[3], item[4]);
    END IF;
  END LOOP;
END $$;