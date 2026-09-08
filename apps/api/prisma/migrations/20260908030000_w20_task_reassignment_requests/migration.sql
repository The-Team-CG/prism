-- W20: auditable event-day task reassignment requests.
CREATE TABLE "staffing_ops"."task_reassignment_requests" (
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

CREATE INDEX "task_reassignment_requests_event_status_requested_idx"
  ON "staffing_ops"."task_reassignment_requests"("event_id", "status", "requested_at");
CREATE INDEX "task_reassignment_requests_task_created_idx"
  ON "staffing_ops"."task_reassignment_requests"("task_id", "created_at");

ALTER TABLE "staffing_ops"."task_reassignment_requests"
  ADD CONSTRAINT "task_reassignment_requests_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_ops"."task_reassignment_requests"
  ADD CONSTRAINT "task_reassignment_requests_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "staffing_ops"."event_day_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
