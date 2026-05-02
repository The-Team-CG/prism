-- Phase 6 event-day operations, coordinator attendance, and supplier setup verification.

ALTER TABLE "ops_supplier_quote_requests"
  ADD COLUMN "event_day_verification_status" TEXT NOT NULL DEFAULT 'self_reported',
  ADD COLUMN "event_day_verified_at" TIMESTAMP(3),
  ADD COLUMN "event_day_verified_by" TEXT,
  ADD COLUMN "event_day_verification_notes" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ops_coordinator_assignments"
  ADD COLUMN "attendance_status" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "attendance_marked_at" TIMESTAMP(3),
  ADD COLUMN "attendance_notes" TEXT NOT NULL DEFAULT '';

CREATE TABLE "ops_event_day_tasks" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "assigned_role" TEXT NOT NULL DEFAULT 'General Coordinator',
  "owner_name" TEXT NOT NULL DEFAULT '',
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "status" TEXT NOT NULL DEFAULT 'open',
  "notes" TEXT NOT NULL DEFAULT '',
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_event_day_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_urgent_issues" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "status" TEXT NOT NULL DEFAULT 'open',
  "owner_role" TEXT NOT NULL DEFAULT '',
  "owner_name" TEXT NOT NULL DEFAULT '',
  "resolution" TEXT NOT NULL DEFAULT '',
  "opened_by" TEXT NOT NULL DEFAULT 'PMCM Admin',
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_urgent_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_event_day_logs" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "action_type" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "actor_role" TEXT NOT NULL DEFAULT 'system',
  "message" TEXT NOT NULL,
  "related_type" TEXT,
  "related_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_event_day_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ops_coordinator_reliability_notes" (
  "id" TEXT NOT NULL,
  "event_id" TEXT,
  "coordinator_id" TEXT,
  "assignment_id" TEXT,
  "note" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'warning',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_coordinator_reliability_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_event_day_tasks_event_id_status_idx" ON "ops_event_day_tasks"("event_id", "status");
CREATE INDEX "ops_event_day_tasks_event_id_assigned_role_idx" ON "ops_event_day_tasks"("event_id", "assigned_role");
CREATE INDEX "ops_urgent_issues_event_id_status_idx" ON "ops_urgent_issues"("event_id", "status");
CREATE INDEX "ops_urgent_issues_event_id_severity_idx" ON "ops_urgent_issues"("event_id", "severity");
CREATE INDEX "ops_event_day_logs_event_id_created_at_idx" ON "ops_event_day_logs"("event_id", "created_at");
CREATE INDEX "ops_event_day_logs_event_id_action_type_idx" ON "ops_event_day_logs"("event_id", "action_type");
CREATE INDEX "ops_coord_reliability_notes_event_id_created_at_idx" ON "ops_coordinator_reliability_notes"("event_id", "created_at");
CREATE INDEX "ops_coord_reliability_notes_coordinator_id_created_at_idx" ON "ops_coordinator_reliability_notes"("coordinator_id", "created_at");

ALTER TABLE "ops_event_day_tasks"
  ADD CONSTRAINT "ops_event_day_tasks_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_urgent_issues"
  ADD CONSTRAINT "ops_urgent_issues_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_event_day_logs"
  ADD CONSTRAINT "ops_event_day_logs_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_coordinator_reliability_notes"
  ADD CONSTRAINT "ops_coordinator_reliability_notes_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_coordinator_reliability_notes"
  ADD CONSTRAINT "ops_coordinator_reliability_notes_coordinator_id_fkey"
  FOREIGN KEY ("coordinator_id") REFERENCES "ops_coordinators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_coordinator_reliability_notes"
  ADD CONSTRAINT "ops_coordinator_reliability_notes_assignment_id_fkey"
  FOREIGN KEY ("assignment_id") REFERENCES "ops_coordinator_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
