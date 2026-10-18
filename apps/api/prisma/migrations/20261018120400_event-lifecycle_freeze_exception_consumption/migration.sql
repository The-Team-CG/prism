-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- AlterTable
ALTER TABLE "event_lifecycle"."event_freeze_exceptions" ADD COLUMN "consumed_at" TIMESTAMP(3),
ADD COLUMN "consumed_by_decision_id" TEXT;
