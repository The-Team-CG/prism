-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: medium

-- Structured JSON columns that default to an empty array or object must keep that top-level shape. The constraints are
-- added NOT VALID on purpose and are not validated here: they apply to every new or updated row, while historical rows
-- (including unparseable legacy payloads and issued snapshots) are left exactly as they are for explicit
-- compatibility handling. Nothing is rewritten or deleted. Payload versions and field-level shapes stay with the
-- shared Zod contracts.

ALTER TABLE "floorplan"."floor_plans"
  ADD CONSTRAINT "floor_plans_guests_shape_chk" CHECK (jsonb_typeof("guests") = 'array') NOT VALID;

ALTER TABLE "floorplan"."floor_plans"
  ADD CONSTRAINT "floor_plans_objects_shape_chk" CHECK (jsonb_typeof("objects") = 'array') NOT VALID;

ALTER TABLE "floorplan"."floor_plans"
  ADD CONSTRAINT "floor_plans_seat_categories_shape_chk" CHECK (jsonb_typeof("seat_categories") = 'array') NOT VALID;

ALTER TABLE "floorplan"."floor_plans"
  ADD CONSTRAINT "floor_plans_seats_shape_chk" CHECK (jsonb_typeof("seats") = 'array') NOT VALID;

ALTER TABLE "floorplan"."floor_plans"
  ADD CONSTRAINT "floor_plans_suppliers_shape_chk" CHECK (jsonb_typeof("suppliers") = 'array') NOT VALID;

ALTER TABLE "floorplan"."venue_templates"
  ADD CONSTRAINT "venue_templates_guests_shape_chk" CHECK (jsonb_typeof("guests") = 'array') NOT VALID;

ALTER TABLE "floorplan"."venue_templates"
  ADD CONSTRAINT "venue_templates_permanent_features_shape_chk" CHECK (jsonb_typeof("permanent_features") = 'array') NOT VALID;

ALTER TABLE "floorplan"."venue_templates"
  ADD CONSTRAINT "venue_templates_suppliers_shape_chk" CHECK (jsonb_typeof("suppliers") = 'array') NOT VALID;

