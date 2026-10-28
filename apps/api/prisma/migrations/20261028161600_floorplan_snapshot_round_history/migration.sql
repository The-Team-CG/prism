-- prism-owner: floorplan
-- prism-kind: mixed
-- prism-risk: medium

CREATE TABLE "floorplan"."floor_plan_snapshot_versions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "snapshot_type" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by_role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_plan_snapshot_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "floor_plan_snapshot_versions_draft_round_type_key"
    ON "floorplan"."floor_plan_snapshot_versions"("draft_id", "round", "snapshot_type");
CREATE INDEX "floor_plan_snapshot_versions_event_draft_created_idx"
    ON "floorplan"."floor_plan_snapshot_versions"("event_id", "draft_id", "created_at");
CREATE UNIQUE INDEX "floor_plan_drafts_id_event_id_key"
    ON "floorplan"."floor_plan_drafts"("id", "event_id");

ALTER TABLE "floorplan"."floor_plan_snapshot_versions"
    ADD CONSTRAINT "floor_plan_snapshot_versions_draft_id_event_id_fkey"
    FOREIGN KEY ("draft_id", "event_id") REFERENCES "floorplan"."floor_plan_drafts"("id", "event_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the currently retained snapshot as the first historical round for existing drafts.
INSERT INTO "floorplan"."floor_plan_snapshot_versions" (
    "id", "event_id", "draft_id", "round", "snapshot_type", "snapshot", "created_by_role", "created_at"
)
SELECT 'fpsv_legacy_submitted_' || "id", "event_id", "id", 1, 'submitted', "submitted_snapshot", "created_by_role", COALESCE("submitted_snapshot_at", "updated_at")
FROM "floorplan"."floor_plan_drafts"
WHERE "submitted_snapshot" IS NOT NULL;

INSERT INTO "floorplan"."floor_plan_snapshot_versions" (
    "id", "event_id", "draft_id", "round", "snapshot_type", "snapshot", "created_by_role", "created_at"
)
SELECT 'fpsv_legacy_approved_' || "id", "event_id", "id", 1, 'approved', "approved_snapshot", "created_by_role", COALESCE("approved_snapshot_at", "updated_at")
FROM "floorplan"."floor_plan_drafts"
WHERE "approved_snapshot" IS NOT NULL;
