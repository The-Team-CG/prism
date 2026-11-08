-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: medium

-- Touches only floorplan client annotations. Existing rows came from the primary contact, so they stay binding (false).
-- AlterTable
ALTER TABLE "floorplan"."client_annotations" ADD COLUMN "non_binding" BOOLEAN NOT NULL DEFAULT false;
