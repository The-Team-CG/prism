-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- Stable row-local rules for Operations data, matching the shared contracts. Each constraint is added NOT VALID and then
-- validated, so a populated database with a violating row aborts the migration with the constraint name and an owner
-- repairs that row explicitly. No row is rewritten or deleted here. Signed values stay legal.

ALTER TABLE "operations"."coordinator_availability"
  ADD CONSTRAINT "coordinator_availability_interval_chk" CHECK ("ends_at" > "starts_at") NOT VALID;
ALTER TABLE "operations"."coordinator_availability" VALIDATE CONSTRAINT "coordinator_availability_interval_chk";

ALTER TABLE "operations"."event_coverage_requirements"
  ADD CONSTRAINT "event_coverage_requirements_required_chk" CHECK ("required" >= 0) NOT VALID;
ALTER TABLE "operations"."event_coverage_requirements" VALIDATE CONSTRAINT "event_coverage_requirements_required_chk";

ALTER TABLE "operations"."guest_roster_imports"
  ADD CONSTRAINT "guest_roster_imports_row_count_chk" CHECK ("row_count" >= 0) NOT VALID;
ALTER TABLE "operations"."guest_roster_imports" VALIDATE CONSTRAINT "guest_roster_imports_row_count_chk";

ALTER TABLE "operations"."feedback"
  ADD CONSTRAINT "feedback_rating_chk" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE "operations"."feedback" VALIDATE CONSTRAINT "feedback_rating_chk";

ALTER TABLE "operations"."feedback_media"
  ADD CONSTRAINT "feedback_media_size_bytes_chk" CHECK ("size_bytes" >= 0) NOT VALID;
ALTER TABLE "operations"."feedback_media" VALIDATE CONSTRAINT "feedback_media_size_bytes_chk";

ALTER TABLE "operations"."registration_platforms"
  ADD CONSTRAINT "registration_platforms_headcount_chk" CHECK ("expected_pax_min" >= 0 AND "expected_pax_max" >= "expected_pax_min" AND "imported_headcount" >= 0) NOT VALID;
ALTER TABLE "operations"."registration_platforms" VALIDATE CONSTRAINT "registration_platforms_headcount_chk";

