-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: medium

-- Touches only floorplan floor plans. Two nullable columns for the Pascal editor scene; existing rows keep their
-- legacy canvas columns and read as having no scene.
-- AlterTable
ALTER TABLE "floorplan"."floor_plans" ADD COLUMN "scene" JSONB,
ADD COLUMN "scene_format" TEXT;
