-- FR-22: coordinator person pool, role/skill tagging, and same-date conflict metadata.

CREATE TABLE "ops_coordinators" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "photo_url" TEXT,
  "role_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "skills_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_coordinators_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ops_coordinator_assignments"
  ADD COLUMN "coordinator_id" TEXT,
  ADD COLUMN "event_date" TIMESTAMP(3),
  ADD COLUMN "conflict_event_id" TEXT,
  ADD COLUMN "conflict_event_name" TEXT,
  ADD COLUMN "acknowledged_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "ops_coordinators_user_id_key" ON "ops_coordinators"("user_id");
CREATE INDEX "ops_coordinators_active_name_idx" ON "ops_coordinators"("active", "name");
CREATE INDEX "ops_coordinators_role_tags_gin_idx" ON "ops_coordinators" USING GIN ("role_tags");
CREATE INDEX "ops_coordinators_skills_tags_gin_idx" ON "ops_coordinators" USING GIN ("skills_tags");
CREATE INDEX "ops_coordinator_assignments_coordinator_id_event_date_idx" ON "ops_coordinator_assignments"("coordinator_id", "event_date");

ALTER TABLE "ops_coordinators"
  ADD CONSTRAINT "ops_coordinators_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "ops_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_coordinator_assignments"
  ADD CONSTRAINT "ops_coordinator_assignments_coordinator_id_fkey"
  FOREIGN KEY ("coordinator_id") REFERENCES "ops_coordinators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

