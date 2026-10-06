-- prism-owner: live-ops
-- prism-kind: schema
-- prism-risk: medium

-- Structured JSON columns that default to an empty array or object must keep that top-level shape. The constraints are
-- added NOT VALID on purpose and are not validated here: they apply to every new or updated row, while historical rows
-- (including unparseable legacy payloads and issued snapshots) are left exactly as they are for explicit
-- compatibility handling. Nothing is rewritten or deleted. Payload versions and field-level shapes stay with the
-- shared Zod contracts.

ALTER TABLE "live_ops"."event_day_logs"
  ADD CONSTRAINT "event_day_logs_metadata_shape_chk" CHECK (jsonb_typeof("metadata") = 'object') NOT VALID;

ALTER TABLE "live_ops"."event_eod_reports"
  ADD CONSTRAINT "event_eod_reports_issues_shape_chk" CHECK (jsonb_typeof("issues") = 'array') NOT VALID;

ALTER TABLE "live_ops"."event_eod_reports"
  ADD CONSTRAINT "event_eod_reports_progress_shape_chk" CHECK (jsonb_typeof("progress") = 'array') NOT VALID;

ALTER TABLE "live_ops"."event_eod_reports"
  ADD CONSTRAINT "event_eod_reports_risks_for_tomorrow_shape_chk" CHECK (jsonb_typeof("risks_for_tomorrow") = 'array') NOT VALID;

ALTER TABLE "live_ops"."event_handoffs"
  ADD CONSTRAINT "event_handoffs_outstanding_items_shape_chk" CHECK (jsonb_typeof("outstanding_items") = 'array') NOT VALID;

