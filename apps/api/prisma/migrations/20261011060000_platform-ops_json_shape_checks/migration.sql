-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

-- Structured JSON columns that default to an empty array or object must keep that top-level shape. The constraints are
-- added NOT VALID on purpose and are not validated here: they apply to every new or updated row, while historical rows
-- (including unparseable legacy payloads and issued snapshots) are left exactly as they are for explicit
-- compatibility handling. Nothing is rewritten or deleted. Payload versions and field-level shapes stay with the
-- shared Zod contracts.

ALTER TABLE "platform_ops"."security_alerts"
  ADD CONSTRAINT "security_alerts_metadata_shape_chk" CHECK (jsonb_typeof("metadata") = 'object') NOT VALID;

ALTER TABLE "platform_ops"."ai_approval_records"
  ADD CONSTRAINT "ai_approval_records_review_payload_shape_chk" CHECK (jsonb_typeof("review_payload") = 'object') NOT VALID;

ALTER TABLE "platform_ops"."ai_audit_logs"
  ADD CONSTRAINT "ai_audit_logs_data_categories_shape_chk" CHECK (jsonb_typeof("data_categories") = 'array') NOT VALID;

ALTER TABLE "platform_ops"."ai_audit_logs"
  ADD CONSTRAINT "ai_audit_logs_sanitized_payload_shape_chk" CHECK (jsonb_typeof("sanitized_payload") = 'object') NOT VALID;

ALTER TABLE "platform_ops"."audit_logs"
  ADD CONSTRAINT "audit_logs_metadata_shape_chk" CHECK (jsonb_typeof("metadata") = 'object') NOT VALID;

