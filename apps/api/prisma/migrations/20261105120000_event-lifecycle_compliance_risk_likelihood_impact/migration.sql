-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "event_lifecycle"."compliance_risks" ADD COLUMN "likelihood" TEXT, ADD COLUMN "impact" TEXT;
ALTER TABLE "event_lifecycle"."compliance_risk_history" ADD COLUMN "likelihood" TEXT, ADD COLUMN "impact" TEXT;
