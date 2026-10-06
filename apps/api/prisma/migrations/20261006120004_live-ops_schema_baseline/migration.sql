-- prism-owner: live-ops
-- prism-kind: schema
-- prism-risk: medium
-- Owner-scoped baseline for the live_ops schema.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "live_ops";

-- CreateTable
CREATE TABLE "live_ops"."event_day_tasks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigned_role" TEXT NOT NULL DEFAULT 'General Coordinator',
    "owner_name" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT NOT NULL DEFAULT '',
    "due_at" TIMESTAMP(3),
    "sla_due_at" TIMESTAMP(3),
    "sla_status" TEXT NOT NULL DEFAULT 'on_track',
    "escalation_level" TEXT NOT NULL DEFAULT 'none',
    "escalated_at" TIMESTAMP(3),
    "escalated_by" TEXT,
    "escalation_notes" TEXT NOT NULL DEFAULT '',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_day_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."task_reassignment_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_by_role" TEXT NOT NULL,
    "from_owner_role" TEXT NOT NULL,
    "from_owner_name" TEXT NOT NULL,
    "to_owner_role" TEXT NOT NULL,
    "to_owner_name" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_approve_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    "decided_by" TEXT,
    "decision_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reassignment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."event_schedule_days" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "day_date" DATE NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."event_schedule_segments" (
    "id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "planned_start_at" TIMESTAMP(3) NOT NULL,
    "planned_end_at" TIMESTAMP(3) NOT NULL,
    "owner_role" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "actual_started_at" TIMESTAMP(3),
    "actual_ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_schedule_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."event_operator_designations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "coordinator_id" TEXT NOT NULL,
    "designated_by" TEXT NOT NULL,
    "designated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_operator_designations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."event_handoffs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "from_assignment_id" TEXT NOT NULL,
    "to_assignment_id" TEXT NOT NULL,
    "handed_off_by" TEXT NOT NULL,
    "received_by" TEXT NOT NULL,
    "handed_off_at" TIMESTAMP(3) NOT NULL,
    "outstanding_items" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."event_eod_reports" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "day_id" TEXT NOT NULL,
    "authored_by" TEXT NOT NULL,
    "authored_by_role" TEXT NOT NULL,
    "progress" JSONB NOT NULL DEFAULT '[]',
    "issues" JSONB NOT NULL DEFAULT '[]',
    "risks_for_tomorrow" JSONB NOT NULL DEFAULT '[]',
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_eod_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."event_eod_replies" (
    "id" TEXT NOT NULL,
    "report_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_eod_replies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."urgent_issues" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'open',
    "affected_area" TEXT NOT NULL DEFAULT '',
    "owner_role" TEXT NOT NULL DEFAULT '',
    "owner_name" TEXT NOT NULL DEFAULT '',
    "resolution" TEXT NOT NULL DEFAULT '',
    "opened_by" TEXT NOT NULL,
    "sla_due_at" TIMESTAMP(3),
    "sla_status" TEXT NOT NULL DEFAULT 'on_track',
    "escalation_level" TEXT NOT NULL DEFAULT 'none',
    "escalated_at" TIMESTAMP(3),
    "escalated_by" TEXT,
    "escalation_notes" TEXT NOT NULL DEFAULT '',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "urgent_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_ops"."event_day_logs" (
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

    CONSTRAINT "event_day_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_day_tasks_event_id_status_idx" ON "live_ops"."event_day_tasks"("event_id", "status");

-- CreateIndex
CREATE INDEX "event_day_tasks_event_id_assigned_role_idx" ON "live_ops"."event_day_tasks"("event_id", "assigned_role");

-- CreateIndex
CREATE INDEX "event_day_tasks_event_id_sla_status_idx" ON "live_ops"."event_day_tasks"("event_id", "sla_status");

-- CreateIndex
CREATE UNIQUE INDEX "event_day_tasks_id_event_id_key" ON "live_ops"."event_day_tasks"("id", "event_id");

-- CreateIndex
CREATE INDEX "task_reassignment_requests_event_status_requested_idx" ON "live_ops"."task_reassignment_requests"("event_id", "status", "requested_at");

-- CreateIndex
CREATE INDEX "task_reassignment_requests_task_created_idx" ON "live_ops"."task_reassignment_requests"("task_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_schedule_days_event_id_day_date_key" ON "live_ops"."event_schedule_days"("event_id", "day_date");

-- CreateIndex
CREATE UNIQUE INDEX "event_schedule_days_id_event_id_key" ON "live_ops"."event_schedule_days"("id", "event_id");

-- CreateIndex
CREATE INDEX "event_schedule_segments_day_id_start_idx" ON "live_ops"."event_schedule_segments"("day_id", "planned_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_schedule_segments_day_id_sequence_key" ON "live_ops"."event_schedule_segments"("day_id", "sequence");

-- CreateIndex
CREATE INDEX "event_operator_designations_event_id_revoked_at_idx" ON "live_ops"."event_operator_designations"("event_id", "revoked_at");

-- CreateIndex
CREATE INDEX "event_operator_designations_coordinator_id_revoked_at_idx" ON "live_ops"."event_operator_designations"("coordinator_id", "revoked_at");

-- CreateIndex
CREATE INDEX "event_handoffs_event_day_time_idx" ON "live_ops"."event_handoffs"("event_id", "day_id", "handed_off_at");

-- CreateIndex
CREATE INDEX "event_handoffs_from_assignment_idx" ON "live_ops"."event_handoffs"("from_assignment_id");

-- CreateIndex
CREATE INDEX "event_handoffs_to_assignment_idx" ON "live_ops"."event_handoffs"("to_assignment_id");

-- CreateIndex
CREATE INDEX "event_eod_reports_event_id_submitted_at_idx" ON "live_ops"."event_eod_reports"("event_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "event_eod_reports_event_id_day_id_key" ON "live_ops"."event_eod_reports"("event_id", "day_id");

-- CreateIndex
CREATE INDEX "event_eod_replies_report_id_created_at_idx" ON "live_ops"."event_eod_replies"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "urgent_issues_event_id_status_idx" ON "live_ops"."urgent_issues"("event_id", "status");

-- CreateIndex
CREATE INDEX "urgent_issues_event_id_severity_idx" ON "live_ops"."urgent_issues"("event_id", "severity");

-- CreateIndex
CREATE INDEX "urgent_issues_event_id_sla_status_idx" ON "live_ops"."urgent_issues"("event_id", "sla_status");

-- CreateIndex
CREATE INDEX "event_day_logs_event_id_created_at_idx" ON "live_ops"."event_day_logs"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "event_day_logs_event_id_action_type_idx" ON "live_ops"."event_day_logs"("event_id", "action_type");

-- AddForeignKey
ALTER TABLE "live_ops"."task_reassignment_requests" ADD CONSTRAINT "task_reassignment_requests_task_event_fkey" FOREIGN KEY ("task_id", "event_id") REFERENCES "live_ops"."event_day_tasks"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_ops"."event_schedule_segments" ADD CONSTRAINT "event_schedule_segments_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "live_ops"."event_schedule_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_ops"."event_handoffs" ADD CONSTRAINT "event_handoffs_day_event_fkey" FOREIGN KEY ("day_id", "event_id") REFERENCES "live_ops"."event_schedule_days"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_ops"."event_eod_reports" ADD CONSTRAINT "event_eod_reports_day_event_fkey" FOREIGN KEY ("day_id", "event_id") REFERENCES "live_ops"."event_schedule_days"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_ops"."event_eod_replies" ADD CONSTRAINT "event_eod_replies_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "live_ops"."event_eod_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
