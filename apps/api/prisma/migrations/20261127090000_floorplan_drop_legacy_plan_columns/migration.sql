-- prism-owner: floorplan
-- prism-kind: schema
-- prism-risk: high

-- Drops the legacy canvas columns once every plan has a Pascal scene. Run
-- `npm --workspace prism-api run db:convert:floorplans` before deploying this migration.
-- The first statement refuses to run while any plan still has no scene: PostgreSQL rejects SET NOT NULL on a
-- column that holds nulls, and the migration runs in one transaction, so nothing is dropped.
-- AlterTable
ALTER TABLE "floorplan"."floor_plans" ALTER COLUMN "scene" SET NOT NULL,
ALTER COLUMN "scene_format" SET NOT NULL;

-- DropTable
DROP TABLE "floorplan"."published_snapshots";

-- DropTable
DROP TABLE "floorplan"."event_instances";

-- DropTable
DROP TABLE "floorplan"."floor_plan_objects";

-- AlterTable
ALTER TABLE "floorplan"."floor_plans" DROP COLUMN "objects",
DROP COLUMN "guests",
DROP COLUMN "suppliers",
DROP COLUMN "seats",
DROP COLUMN "seat_categories";

-- AlterTable
ALTER TABLE "floorplan"."venue_templates" DROP COLUMN "guests",
DROP COLUMN "suppliers",
DROP COLUMN "include_guests",
DROP COLUMN "include_suppliers";
