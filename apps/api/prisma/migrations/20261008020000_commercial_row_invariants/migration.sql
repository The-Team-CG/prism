-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Stable row-local rules for Commercial data, matching the shared Zod contracts. Each constraint is added NOT VALID and
-- then validated, so a populated database with a violating row aborts the migration with the constraint name and an
-- owner repairs that row explicitly. No row is rewritten or deleted here.
--
-- Signed values stay legal: payment milestone balances and adjustments are not constrained to be non-negative, only
-- the recorded receipt amount (a receipt is always a positive amount) and the original milestone amount.

ALTER TABLE "commercial"."supplier_reviews"
  ADD CONSTRAINT "supplier_reviews_rating_chk" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE "commercial"."supplier_reviews" VALIDATE CONSTRAINT "supplier_reviews_rating_chk";

ALTER TABLE "commercial"."supplier_review_dimension_ratings"
  ADD CONSTRAINT "supplier_review_dimension_ratings_rating_chk" CHECK ("rating" BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE "commercial"."supplier_review_dimension_ratings" VALIDATE CONSTRAINT "supplier_review_dimension_ratings_rating_chk";

ALTER TABLE "commercial"."payment_records"
  ADD CONSTRAINT "payment_records_amount_received_chk" CHECK ("amount_received" > 0) NOT VALID;
ALTER TABLE "commercial"."payment_records" VALIDATE CONSTRAINT "payment_records_amount_received_chk";

ALTER TABLE "commercial"."payment_milestones"
  ADD CONSTRAINT "payment_milestones_percentage_chk" CHECK ("percentage" BETWEEN 0 AND 100) NOT VALID,
  ADD CONSTRAINT "payment_milestones_amount_chk" CHECK ("amount" >= 0 AND "amount_paid" >= 0) NOT VALID;
ALTER TABLE "commercial"."payment_milestones" VALIDATE CONSTRAINT "payment_milestones_percentage_chk";
ALTER TABLE "commercial"."payment_milestones" VALIDATE CONSTRAINT "payment_milestones_amount_chk";

ALTER TABLE "commercial"."supplier_schedules"
  ADD CONSTRAINT "supplier_schedules_interval_chk" CHECK ("egress_at" >= "ingress_at") NOT VALID;
ALTER TABLE "commercial"."supplier_schedules" VALIDATE CONSTRAINT "supplier_schedules_interval_chk";

ALTER TABLE "commercial"."quotes"
  ADD CONSTRAINT "quotes_amount_chk" CHECK ("amount" >= 0 AND "revision_number" >= 1) NOT VALID,
  ADD CONSTRAINT "quotes_acceptable_range_chk"
    CHECK ("acceptable_min" IS NULL OR "acceptable_max" IS NULL OR "acceptable_min" <= "acceptable_max") NOT VALID;
ALTER TABLE "commercial"."quotes" VALIDATE CONSTRAINT "quotes_amount_chk";
ALTER TABLE "commercial"."quotes" VALIDATE CONSTRAINT "quotes_acceptable_range_chk";

ALTER TABLE "commercial"."supplier_availability"
  ADD CONSTRAINT "supplier_availability_capacity_chk" CHECK ("capacity" >= 0) NOT VALID;
ALTER TABLE "commercial"."supplier_availability" VALIDATE CONSTRAINT "supplier_availability_capacity_chk";

ALTER TABLE "commercial"."cost_estimates"
  ADD CONSTRAINT "cost_estimates_amounts_chk" CHECK ("budget_amount" >= 0 AND "total_amount" >= 0) NOT VALID;
ALTER TABLE "commercial"."cost_estimates" VALIDATE CONSTRAINT "cost_estimates_amounts_chk";

ALTER TABLE "commercial"."proposal_versions"
  ADD CONSTRAINT "proposal_versions_total_amount_chk" CHECK ("total_amount" >= 0 AND "version_number" >= 1) NOT VALID;
ALTER TABLE "commercial"."proposal_versions" VALIDATE CONSTRAINT "proposal_versions_total_amount_chk";

ALTER TABLE "commercial"."billing_sources"
  ADD CONSTRAINT "billing_sources_total_amount_chk" CHECK ("total_amount" >= 0) NOT VALID;
ALTER TABLE "commercial"."billing_sources" VALIDATE CONSTRAINT "billing_sources_total_amount_chk";

ALTER TABLE "commercial"."additional_billings"
  ADD CONSTRAINT "additional_billings_amount_chk" CHECK ("amount" >= 0) NOT VALID;
ALTER TABLE "commercial"."additional_billings" VALIDATE CONSTRAINT "additional_billings_amount_chk";
