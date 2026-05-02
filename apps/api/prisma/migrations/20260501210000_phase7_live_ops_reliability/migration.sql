-- Phase 7 live-ops reliability metadata for SLA tracking and escalation.

ALTER TABLE "ops_event_day_tasks"
  ADD COLUMN "sla_due_at" TIMESTAMP(3),
  ADD COLUMN "sla_status" TEXT NOT NULL DEFAULT 'on_track',
  ADD COLUMN "escalation_level" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "escalated_at" TIMESTAMP(3),
  ADD COLUMN "escalated_by" TEXT,
  ADD COLUMN "escalation_notes" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ops_urgent_issues"
  ADD COLUMN "sla_due_at" TIMESTAMP(3),
  ADD COLUMN "sla_status" TEXT NOT NULL DEFAULT 'on_track',
  ADD COLUMN "escalation_level" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "escalated_at" TIMESTAMP(3),
  ADD COLUMN "escalated_by" TEXT,
  ADD COLUMN "escalation_notes" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ops_coordinator_assignments"
  ADD COLUMN "replaced_by_assignment_id" TEXT,
  ADD COLUMN "replacement_reason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "replaced_at" TIMESTAMP(3),
  ADD COLUMN "replaced_by" TEXT;

CREATE INDEX "ops_event_day_tasks_event_id_sla_status_idx"
  ON "ops_event_day_tasks"("event_id", "sla_status");

CREATE INDEX "ops_urgent_issues_event_id_sla_status_idx"
  ON "ops_urgent_issues"("event_id", "sla_status");

CREATE INDEX "ops_coordinator_assignments_event_id_attendance_status_idx"
  ON "ops_coordinator_assignments"("event_id", "attendance_status");
