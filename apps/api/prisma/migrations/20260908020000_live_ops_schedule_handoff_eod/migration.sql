-- W21: persisted multi-day schedules, explicit operator authority, handoffs and EOD reports.
CREATE TABLE "staffing_ops"."event_schedule_days" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "day_date" DATE NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'planned',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_schedule_days_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_schedule_days_event_id_day_date_key" ON "staffing_ops"."event_schedule_days"("event_id", "day_date");
CREATE INDEX "event_schedule_days_event_id_day_date_idx" ON "staffing_ops"."event_schedule_days"("event_id", "day_date");
ALTER TABLE "staffing_ops"."event_schedule_days" ADD CONSTRAINT "event_schedule_days_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "staffing_ops"."event_schedule_segments" (
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
CREATE UNIQUE INDEX "event_schedule_segments_day_id_sequence_key" ON "staffing_ops"."event_schedule_segments"("day_id", "sequence");
CREATE INDEX "event_schedule_segments_day_id_start_idx" ON "staffing_ops"."event_schedule_segments"("day_id", "planned_start_at");
ALTER TABLE "staffing_ops"."event_schedule_segments" ADD CONSTRAINT "event_schedule_segments_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "staffing_ops"."event_schedule_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "staffing_ops"."event_operator_designations" (
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
CREATE INDEX "event_operator_designations_event_id_revoked_at_idx" ON "staffing_ops"."event_operator_designations"("event_id", "revoked_at");
CREATE INDEX "event_operator_designations_coordinator_id_revoked_at_idx" ON "staffing_ops"."event_operator_designations"("coordinator_id", "revoked_at");
ALTER TABLE "staffing_ops"."event_operator_designations" ADD CONSTRAINT "event_operator_designations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_ops"."event_operator_designations" ADD CONSTRAINT "event_operator_designations_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "staffing_ops"."coordinators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "staffing_ops"."event_handoffs" (
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
CREATE INDEX "event_handoffs_event_day_time_idx" ON "staffing_ops"."event_handoffs"("event_id", "day_id", "handed_off_at");
CREATE INDEX "event_handoffs_from_assignment_idx" ON "staffing_ops"."event_handoffs"("from_assignment_id");
CREATE INDEX "event_handoffs_to_assignment_idx" ON "staffing_ops"."event_handoffs"("to_assignment_id");
ALTER TABLE "staffing_ops"."event_handoffs" ADD CONSTRAINT "event_handoffs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_ops"."event_handoffs" ADD CONSTRAINT "event_handoffs_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "staffing_ops"."event_schedule_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "staffing_ops"."event_eod_reports" (
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
CREATE UNIQUE INDEX "event_eod_reports_event_id_day_id_key" ON "staffing_ops"."event_eod_reports"("event_id", "day_id");
CREATE INDEX "event_eod_reports_event_id_submitted_at_idx" ON "staffing_ops"."event_eod_reports"("event_id", "submitted_at");
ALTER TABLE "staffing_ops"."event_eod_reports" ADD CONSTRAINT "event_eod_reports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_ops"."event_eod_reports" ADD CONSTRAINT "event_eod_reports_day_id_fkey" FOREIGN KEY ("day_id") REFERENCES "staffing_ops"."event_schedule_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "staffing_ops"."event_eod_replies" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "author_role" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_eod_replies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_eod_replies_report_id_created_at_idx" ON "staffing_ops"."event_eod_replies"("report_id", "created_at");
ALTER TABLE "staffing_ops"."event_eod_replies" ADD CONSTRAINT "event_eod_replies_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "staffing_ops"."event_eod_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
