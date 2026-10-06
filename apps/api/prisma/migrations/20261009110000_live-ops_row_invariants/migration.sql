-- prism-owner: live-ops
-- prism-kind: schema
-- prism-risk: medium

-- Stable row-local rules for LiveOps data, matching the shared contracts. Each constraint is added NOT VALID and then
-- validated, so a populated database with a violating row aborts the migration with the constraint name and an owner
-- repairs that row explicitly. No row is rewritten or deleted here. Signed values stay legal.

ALTER TABLE "live_ops"."event_schedule_segments"
  ADD CONSTRAINT "event_schedule_segments_planned_interval_chk" CHECK ("planned_end_at" >= "planned_start_at" AND "sequence" >= 0) NOT VALID;
ALTER TABLE "live_ops"."event_schedule_segments" VALIDATE CONSTRAINT "event_schedule_segments_planned_interval_chk";

ALTER TABLE "live_ops"."event_schedule_segments"
  ADD CONSTRAINT "event_schedule_segments_actual_interval_chk" CHECK ("actual_started_at" IS NULL OR "actual_ended_at" IS NULL OR "actual_ended_at" >= "actual_started_at") NOT VALID;
ALTER TABLE "live_ops"."event_schedule_segments" VALIDATE CONSTRAINT "event_schedule_segments_actual_interval_chk";

ALTER TABLE "live_ops"."event_operator_designations"
  ADD CONSTRAINT "event_operator_designations_revoked_chk" CHECK ("revoked_at" IS NULL OR "revoked_at" >= "designated_at") NOT VALID;
ALTER TABLE "live_ops"."event_operator_designations" VALIDATE CONSTRAINT "event_operator_designations_revoked_chk";

ALTER TABLE "live_ops"."task_reassignment_requests"
  ADD CONSTRAINT "task_reassignment_requests_timing_chk" CHECK ("auto_approve_at" >= "requested_at" AND ("decided_at" IS NULL OR "decided_at" >= "requested_at")) NOT VALID;
ALTER TABLE "live_ops"."task_reassignment_requests" VALIDATE CONSTRAINT "task_reassignment_requests_timing_chk";

