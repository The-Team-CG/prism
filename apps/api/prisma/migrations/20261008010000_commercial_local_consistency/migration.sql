-- prism-owner: commercial
-- prism-kind: mixed
-- prism-risk: high

-- Same-Commercial agreement between a child row and its parent: the child's event_id must equal the parent's
-- event_id. Every foreign key below stays inside the commercial schema; none references another domain.
--
-- Evidence is never deleted. A child whose event_id disagrees with its parent is realigned to the parent's event
-- (the parent is the financial record of truth). A child whose parent is missing makes the VALIDATE step fail and
-- aborts the migration, so an owner repairs the orphan explicitly first.

-- Supporting keys (id, event_id) so children can reference the pair.
CREATE UNIQUE INDEX "payment_milestones_id_event_id_key" ON "commercial"."payment_milestones" ("id", "event_id");
CREATE UNIQUE INDEX "cost_estimates_id_event_id_key" ON "commercial"."cost_estimates" ("id", "event_id");
CREATE UNIQUE INDEX "quote_requests_id_event_id_key" ON "commercial"."quote_requests" ("id", "event_id");
CREATE UNIQUE INDEX "billing_statements_id_event_id_key" ON "commercial"."billing_statements" ("id", "event_id");
-- Prisma models the schedule-to-request link as one-to-one, so the child pair is unique as well.
CREATE UNIQUE INDEX "supplier_schedules_request_id_event_id_key" ON "commercial"."supplier_schedules" ("request_id", "event_id");

-- Realign event disagreements to the parent.
UPDATE "commercial"."payment_records"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "commercial"."payment_milestones") "parents"
WHERE "milestone_id" = "parent_id" AND "event_id" <> "parent_event";

UPDATE "commercial"."proposal_versions"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "commercial"."cost_estimates") "parents"
WHERE "cost_estimate_id" = "parent_id" AND "event_id" <> "parent_event";

UPDATE "commercial"."supplier_schedules"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "commercial"."quote_requests") "parents"
WHERE "request_id" = "parent_id" AND "event_id" <> "parent_event";

UPDATE "commercial"."billing_corrections"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "commercial"."billing_statements") "parents"
WHERE "statement_id" = "parent_id" AND "event_id" <> "parent_event";

UPDATE "commercial"."billing_disputes"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "commercial"."billing_statements") "parents"
WHERE "statement_id" = "parent_id" AND "event_id" <> "parent_event";

-- Payment history is evidence: deleting a milestone no longer cascades to its payment records.
ALTER TABLE "commercial"."payment_records" DROP CONSTRAINT "payment_records_milestone_id_fkey";
ALTER TABLE "commercial"."payment_records"
  ADD CONSTRAINT "payment_records_milestone_event_fkey"
  FOREIGN KEY ("milestone_id", "event_id") REFERENCES "commercial"."payment_milestones" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "commercial"."payment_records" VALIDATE CONSTRAINT "payment_records_milestone_event_fkey";

ALTER TABLE "commercial"."proposal_versions" DROP CONSTRAINT "proposal_versions_cost_estimate_id_fkey";
ALTER TABLE "commercial"."proposal_versions"
  ADD CONSTRAINT "proposal_versions_cost_estimate_event_fkey"
  FOREIGN KEY ("cost_estimate_id", "event_id") REFERENCES "commercial"."cost_estimates" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "commercial"."proposal_versions" VALIDATE CONSTRAINT "proposal_versions_cost_estimate_event_fkey";

-- A supplier schedule is derived from its request, so it still goes away with the request.
ALTER TABLE "commercial"."supplier_schedules" DROP CONSTRAINT "supplier_schedules_request_id_fkey";
ALTER TABLE "commercial"."supplier_schedules"
  ADD CONSTRAINT "supplier_schedules_request_event_fkey"
  FOREIGN KEY ("request_id", "event_id") REFERENCES "commercial"."quote_requests" ("id", "event_id")
  ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "commercial"."supplier_schedules" VALIDATE CONSTRAINT "supplier_schedules_request_event_fkey";

-- Corrections and disputes were unlinked. They are billing evidence, so the statement cannot be deleted under them.
ALTER TABLE "commercial"."billing_corrections"
  ADD CONSTRAINT "billing_corrections_statement_event_fkey"
  FOREIGN KEY ("statement_id", "event_id") REFERENCES "commercial"."billing_statements" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "commercial"."billing_corrections" VALIDATE CONSTRAINT "billing_corrections_statement_event_fkey";

ALTER TABLE "commercial"."billing_disputes"
  ADD CONSTRAINT "billing_disputes_statement_event_fkey"
  FOREIGN KEY ("statement_id", "event_id") REFERENCES "commercial"."billing_statements" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "commercial"."billing_disputes" VALIDATE CONSTRAINT "billing_disputes_statement_event_fkey";

-- milestone_id is nullable, so a dispute without a milestone is unaffected (MATCH SIMPLE).
ALTER TABLE "commercial"."billing_disputes"
  ADD CONSTRAINT "billing_disputes_milestone_event_fkey"
  FOREIGN KEY ("milestone_id", "event_id") REFERENCES "commercial"."payment_milestones" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "commercial"."billing_disputes" VALIDATE CONSTRAINT "billing_disputes_milestone_event_fkey";
