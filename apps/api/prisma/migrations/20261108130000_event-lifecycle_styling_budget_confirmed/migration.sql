-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- Touches only event_lifecycle.briefings. Null means the styling budget was not confirmed by the primary client.
-- AlterTable
ALTER TABLE "event_lifecycle"."briefings" ADD COLUMN "styling_budget_confirmed_at" TIMESTAMP(3);
