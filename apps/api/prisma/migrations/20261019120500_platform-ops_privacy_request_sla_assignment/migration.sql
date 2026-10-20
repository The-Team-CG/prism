-- prism-owner: platform-ops
-- prism-kind: mixed
-- prism-risk: medium

-- Adds the privacy request SLA deadline and optional PMCM operator assignment.
-- Existing rows are backfilled from their submission time (created_at + 30 days);
-- no request rows are deleted or have their status changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- AlterTable
ALTER TABLE "platform_ops"."privacy_requests" ADD COLUMN "due_at" TIMESTAMP(3),
ADD COLUMN "assigned_to" TEXT;

-- Backfill: the 30-day SLA counts from submission, matching PRISM_PRIVACY_REQUEST_SLA_DAYS in the API.
UPDATE "platform_ops"."privacy_requests"
SET "due_at" = "created_at" + INTERVAL '30 days'
WHERE "due_at" IS NULL;

ALTER TABLE "platform_ops"."privacy_requests" ALTER COLUMN "due_at" SET NOT NULL;

-- CreateIndex
CREATE INDEX "privacy_requests_status_due_at_idx" ON "platform_ops"."privacy_requests"("status", "due_at");

-- CreateIndex
CREATE INDEX "privacy_requests_assigned_to_idx" ON "platform_ops"."privacy_requests"("assigned_to");

COMMIT;
