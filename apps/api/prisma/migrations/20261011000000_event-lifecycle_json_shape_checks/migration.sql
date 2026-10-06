-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- Structured JSON columns that default to an empty array or object must keep that top-level shape. The constraints are
-- added NOT VALID on purpose and are not validated here: they apply to every new or updated row, while historical rows
-- (including unparseable legacy payloads and issued snapshots) are left exactly as they are for explicit
-- compatibility handling. Nothing is rewritten or deleted. Payload versions and field-level shapes stay with the
-- shared Zod contracts.

ALTER TABLE "event_lifecycle"."compliance_checks"
  ADD CONSTRAINT "compliance_checks_evidence_shape_chk" CHECK (jsonb_typeof("evidence") = 'array') NOT VALID;

ALTER TABLE "event_lifecycle"."event_insights"
  ADD CONSTRAINT "event_insights_dimensions_shape_chk" CHECK (jsonb_typeof("dimensions") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."event_insights"
  ADD CONSTRAINT "event_insights_document_summary_shape_chk" CHECK (jsonb_typeof("document_summary") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."event_insights"
  ADD CONSTRAINT "event_insights_feedback_summary_shape_chk" CHECK (jsonb_typeof("feedback_summary") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."event_insights"
  ADD CONSTRAINT "event_insights_financial_summary_shape_chk" CHECK (jsonb_typeof("financial_summary") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."event_insights"
  ADD CONSTRAINT "event_insights_highlights_shape_chk" CHECK (jsonb_typeof("highlights") = 'array') NOT VALID;

ALTER TABLE "event_lifecycle"."event_insights"
  ADD CONSTRAINT "event_insights_risks_shape_chk" CHECK (jsonb_typeof("risks") = 'array') NOT VALID;

ALTER TABLE "event_lifecycle"."event_insights"
  ADD CONSTRAINT "event_insights_supplier_notes_shape_chk" CHECK (jsonb_typeof("supplier_notes") = 'array') NOT VALID;

ALTER TABLE "event_lifecycle"."event_wrap_ups"
  ADD CONSTRAINT "event_wrap_ups_required_items_shape_chk" CHECK (jsonb_typeof("required_items") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."event_wrap_ups"
  ADD CONSTRAINT "event_wrap_ups_sections_shape_chk" CHECK (jsonb_typeof("sections") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."addenda"
  ADD CONSTRAINT "addenda_comparison_shape_chk" CHECK (jsonb_typeof("comparison") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."briefings"
  ADD CONSTRAINT "briefings_program_shape_chk" CHECK (jsonb_typeof("program") = 'array') NOT VALID;

ALTER TABLE "event_lifecycle"."briefings"
  ADD CONSTRAINT "briefings_service_requirements_shape_chk" CHECK (jsonb_typeof("service_requirements") = 'array') NOT VALID;

ALTER TABLE "event_lifecycle"."event_decisions"
  ADD CONSTRAINT "event_decisions_assignment_impact_shape_chk" CHECK (jsonb_typeof("assignment_impact") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."event_decisions"
  ADD CONSTRAINT "event_decisions_financial_impact_shape_chk" CHECK (jsonb_typeof("financial_impact") = 'object') NOT VALID;

ALTER TABLE "event_lifecycle"."events"
  ADD CONSTRAINT "events_archive_checklist_shape_chk" CHECK (jsonb_typeof("archive_checklist") = 'object') NOT VALID;

