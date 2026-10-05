-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "event_core"."events"
  ADD COLUMN "floor_plan_projection_version" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "events_floor_plan_projection_version_nonnegative_check"
    CHECK ("floor_plan_projection_version" >= 0);
