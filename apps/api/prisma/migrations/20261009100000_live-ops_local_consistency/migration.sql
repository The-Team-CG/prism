-- prism-owner: live-ops
-- prism-kind: mixed
-- prism-risk: high

-- LiveOps event-day records agree with their parent on the event: a task reassignment request belongs to the same
-- event as its task, and a handoff or end-of-day report belongs to the same event as its schedule day. All keys stay
-- inside the live_ops schema. Assignment IDs on handoffs remain external references with no foreign key.
--
-- Handoffs, end-of-day reports and reassignment requests are event-day evidence, so the parent no longer cascades
-- them away: deleting a task or schedule day that still has any is refused. Nothing in the application deletes them.
-- A child whose event disagrees with its parent is realigned to the parent's event; an orphan makes validation fail
-- and aborts the migration so an owner repairs it explicitly.

CREATE UNIQUE INDEX "event_day_tasks_id_event_id_key" ON "live_ops"."event_day_tasks" ("id", "event_id");
CREATE UNIQUE INDEX "event_schedule_days_id_event_id_key" ON "live_ops"."event_schedule_days" ("id", "event_id");

UPDATE "live_ops"."task_reassignment_requests"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "live_ops"."event_day_tasks") "parents"
WHERE "task_id" = "parent_id" AND "event_id" <> "parent_event";

UPDATE "live_ops"."event_handoffs"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "live_ops"."event_schedule_days") "parents"
WHERE "day_id" = "parent_id" AND "event_id" <> "parent_event";

UPDATE "live_ops"."event_eod_reports"
SET "event_id" = "parent_event"
FROM (SELECT "id" AS "parent_id", "event_id" AS "parent_event" FROM "live_ops"."event_schedule_days") "parents"
WHERE "day_id" = "parent_id" AND "event_id" <> "parent_event";

ALTER TABLE "live_ops"."task_reassignment_requests" DROP CONSTRAINT "task_reassignment_requests_task_id_fkey";
ALTER TABLE "live_ops"."task_reassignment_requests"
  ADD CONSTRAINT "task_reassignment_requests_task_event_fkey"
  FOREIGN KEY ("task_id", "event_id") REFERENCES "live_ops"."event_day_tasks" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "live_ops"."task_reassignment_requests" VALIDATE CONSTRAINT "task_reassignment_requests_task_event_fkey";

ALTER TABLE "live_ops"."event_handoffs" DROP CONSTRAINT "event_handoffs_day_id_fkey";
ALTER TABLE "live_ops"."event_handoffs"
  ADD CONSTRAINT "event_handoffs_day_event_fkey"
  FOREIGN KEY ("day_id", "event_id") REFERENCES "live_ops"."event_schedule_days" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "live_ops"."event_handoffs" VALIDATE CONSTRAINT "event_handoffs_day_event_fkey";

ALTER TABLE "live_ops"."event_eod_reports" DROP CONSTRAINT "event_eod_reports_day_id_fkey";
ALTER TABLE "live_ops"."event_eod_reports"
  ADD CONSTRAINT "event_eod_reports_day_event_fkey"
  FOREIGN KEY ("day_id", "event_id") REFERENCES "live_ops"."event_schedule_days" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "live_ops"."event_eod_reports" VALIDATE CONSTRAINT "event_eod_reports_day_event_fkey";
