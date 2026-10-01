-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "floorplan"."floor_plan_drafts"
  ALTER COLUMN "created_by_role" DROP DEFAULT;
