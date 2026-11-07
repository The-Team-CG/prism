-- prism-owner: event-lifecycle
-- prism-kind: mixed
-- prism-risk: medium

-- Touches only event_lifecycle.addenda. Commercial rows (billing sources, statements, quotes) are not changed here.

-- AlterTable
ALTER TABLE "event_lifecycle"."addenda" ADD COLUMN "planned_impacts" JSONB,
ADD COLUMN "effective_at" TIMESTAMP(3),
ADD COLUMN "withdrawn_at" TIMESTAMP(3),
ADD COLUMN "withdrawn_by" TEXT,
ADD COLUMN "withdrawal_reason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- Backfill: every addendum issued before this change already applied its billing and quote effect at issue.
-- Marking it effective at its issue time keeps all existing rows in the new format with no billing rewrite.
UPDATE "event_lifecycle"."addenda"
SET "status" = 'effective', "effective_at" = "issued_at"
WHERE "status" = 'issued';

-- CreateIndex
CREATE UNIQUE INDEX "addenda_one_pending_per_event_key" ON "event_lifecycle"."addenda"("event_id") WHERE "status" = 'pending';
