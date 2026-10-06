-- prism-owner: floorplan
-- prism-kind: mixed
-- prism-risk: medium

-- One active official draft per event. Approval already deactivates the previous active draft inside the
-- event-locked transaction; this index makes the invariant hold for every writer, including concurrent ones.
--
-- If an event already has more than one active draft, keep the most recently approved one active and
-- deactivate the rest. Inactive drafts are history and are never deleted.
UPDATE "floorplan"."floor_plan_drafts"
SET "is_active" = false
WHERE "id" IN (
  SELECT "id"
  FROM (
    SELECT "id",
           row_number() OVER (
             PARTITION BY "event_id"
             ORDER BY "approved_at" DESC NULLS LAST, "updated_at" DESC, "id" DESC
           ) AS "active_rank"
    FROM "floorplan"."floor_plan_drafts"
    WHERE "is_active"
  ) "ranked"
  WHERE "active_rank" > 1
);

CREATE UNIQUE INDEX "floor_plan_drafts_one_active_per_event_key"
  ON "floorplan"."floor_plan_drafts" ("event_id")
  WHERE "is_active";
