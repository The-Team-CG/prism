-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: medium
-- event_id is an external reference to event-lifecycle; no cross-domain FK is created.

CREATE TABLE "floorplan"."floor_plan_projection_clocks" (
  "event_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "floor_plan_projection_clocks_pkey" PRIMARY KEY ("event_id"),
  CONSTRAINT "floor_plan_projection_clocks_version_nonnegative_check"
    CHECK ("version" >= 0)
);
