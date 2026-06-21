DO $$
DECLARE
  item text[];
BEGIN
  FOREACH item SLICE 1 IN ARRAY ARRAY[
    ARRAY['compliance_ops', 'ops_event_insights_event_id_key', 'event_insights_event_id_key'],
    ARRAY['finance_ops', 'ops_billing_statements_number_key', 'billing_statements_number_key'],
    ARRAY['floorplan', 'ops_floor_plan_drafts_floor_plan_id_key', 'floor_plan_drafts_floor_plan_id_key'],
    ARRAY['identity', 'ops_users_email_key', 'users_email_key'],
    ARRAY['staffing_ops', 'ops_coordinators_role_tags_gin_idx', 'coordinators_role_tags_gin_idx'],
    ARRAY['staffing_ops', 'ops_coordinators_skills_tags_gin_idx', 'coordinators_skills_tags_gin_idx'],
    ARRAY['staffing_ops', 'ops_coordinators_user_id_key', 'coordinators_user_id_key'],
    ARRAY['supplier_ops', 'ops_supplier_categories_slug_key', 'supplier_categories_slug_key'],
    ARRAY['supplier_ops', 'ops_supplier_quote_requests_access_token_key', 'quote_requests_access_token_key']
  ] LOOP
    IF to_regclass(format('%I.%I', item[1], item[2])) IS NOT NULL
       AND to_regclass(format('%I.%I', item[1], item[3])) IS NULL THEN
      EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', item[1], item[2], item[3]);
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS events_inquiry_id_idx
  ON event_core.events (inquiry_id);

CREATE INDEX IF NOT EXISTS event_instances_template_id_idx
  ON floorplan.event_instances (template_id);

CREATE INDEX IF NOT EXISTS security_alerts_event_id_idx
  ON identity.security_alerts (event_id);

CREATE INDEX IF NOT EXISTS coordinator_reliability_notes_assignment_id_idx
  ON staffing_ops.coordinator_reliability_notes (assignment_id);

CREATE INDEX IF NOT EXISTS quote_requests_contract_document_id_idx
  ON supplier_ops.quote_requests (contract_document_id);

CREATE INDEX IF NOT EXISTS ai_audit_logs_event_id_idx
  ON trust_ops.ai_audit_logs (event_id);

CREATE INDEX IF NOT EXISTS ai_approval_records_event_id_idx
  ON trust_ops.ai_approval_records (event_id);
