CREATE TABLE IF NOT EXISTS "ops_floor_plan_drafts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "floor_plan_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "source_type" TEXT NOT NULL DEFAULT 'blank',
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_floor_plan_drafts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ops_floor_plan_drafts_floor_plan_id_key"
ON "ops_floor_plan_drafts"("floor_plan_id");

CREATE INDEX IF NOT EXISTS "ops_floor_plan_drafts_event_id_status_idx"
ON "ops_floor_plan_drafts"("event_id", "status");

CREATE INDEX IF NOT EXISTS "ops_floor_plan_drafts_event_id_is_active_idx"
ON "ops_floor_plan_drafts"("event_id", "is_active");

ALTER TABLE "ops_floor_plan_drafts" ADD CONSTRAINT "ops_floor_plan_drafts_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_floor_plan_drafts" ADD CONSTRAINT "ops_floor_plan_drafts_floor_plan_id_fkey"
FOREIGN KEY ("floor_plan_id") REFERENCES "floor_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
