-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-24: modules PMCM switches off per event. Every existing event keeps every module.
ALTER TABLE "event_lifecycle"."events" ADD COLUMN "disabled_modules" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
