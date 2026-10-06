-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Structured JSON columns that default to an empty array or object must keep that top-level shape. The constraints are
-- added NOT VALID on purpose and are not validated here: they apply to every new or updated row, while historical rows
-- (including unparseable legacy payloads and issued snapshots) are left exactly as they are for explicit
-- compatibility handling. Nothing is rewritten or deleted. Payload versions and field-level shapes stay with the
-- shared Zod contracts.

ALTER TABLE "commercial"."billing_sources"
  ADD CONSTRAINT "billing_sources_line_items_shape_chk" CHECK (jsonb_typeof("line_items") = 'array') NOT VALID;

ALTER TABLE "commercial"."billing_sources"
  ADD CONSTRAINT "billing_sources_payment_methods_shape_chk" CHECK (jsonb_typeof("payment_methods") = 'array') NOT VALID;

ALTER TABLE "commercial"."billing_sources"
  ADD CONSTRAINT "billing_sources_payment_schedule_shape_chk" CHECK (jsonb_typeof("payment_schedule") = 'array') NOT VALID;

ALTER TABLE "commercial"."billing_statements"
  ADD CONSTRAINT "billing_statements_line_items_shape_chk" CHECK (jsonb_typeof("line_items") = 'array') NOT VALID;

ALTER TABLE "commercial"."billing_statements"
  ADD CONSTRAINT "billing_statements_payment_methods_shape_chk" CHECK (jsonb_typeof("payment_methods") = 'array') NOT VALID;

ALTER TABLE "commercial"."billing_statements"
  ADD CONSTRAINT "billing_statements_payment_schedule_shape_chk" CHECK (jsonb_typeof("payment_schedule") = 'array') NOT VALID;

ALTER TABLE "commercial"."quotes"
  ADD CONSTRAINT "quotes_inclusions_shape_chk" CHECK (jsonb_typeof("inclusions") = 'array') NOT VALID;

