-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- Stable row-local rules for Lifecycle data, matching the shared contracts. Each constraint is added NOT VALID and then
-- validated, so a populated database with a violating row aborts the migration with the constraint name and an owner
-- repairs that row explicitly. No row is rewritten or deleted here. Signed values stay legal.

ALTER TABLE "event_lifecycle"."events"
  ADD CONSTRAINT "events_counts_chk" CHECK ("walk_in_threshold" >= 0 AND "proposal_revision_count" >= 0 AND "floor_plan_projection_version" >= 0) NOT VALID;
ALTER TABLE "event_lifecycle"."events" VALIDATE CONSTRAINT "events_counts_chk";

ALTER TABLE "event_lifecycle"."inquiries"
  ADD CONSTRAINT "inquiries_follow_up_interval_chk" CHECK ("follow_up_interval_days" >= 0) NOT VALID;
ALTER TABLE "event_lifecycle"."inquiries" VALIDATE CONSTRAINT "inquiries_follow_up_interval_chk";

ALTER TABLE "event_lifecycle"."briefings"
  ADD CONSTRAINT "briefings_guest_count_chk" CHECK ("guest_count" >= 0 AND ("styling_budget" IS NULL OR "styling_budget" >= 0)) NOT VALID;
ALTER TABLE "event_lifecycle"."briefings" VALIDATE CONSTRAINT "briefings_guest_count_chk";

ALTER TABLE "event_lifecycle"."documents"
  ADD CONSTRAINT "documents_size_bytes_chk" CHECK ("size_bytes" IS NULL OR "size_bytes" >= 0) NOT VALID;
ALTER TABLE "event_lifecycle"."documents" VALIDATE CONSTRAINT "documents_size_bytes_chk";

ALTER TABLE "event_lifecycle"."compliance_runs"
  ADD CONSTRAINT "compliance_runs_counts_chk" CHECK ("rule_count" >= 0 AND ("completed_at" IS NULL OR "completed_at" >= "started_at")) NOT VALID;
ALTER TABLE "event_lifecycle"."compliance_runs" VALIDATE CONSTRAINT "compliance_runs_counts_chk";

ALTER TABLE "event_lifecycle"."event_wrap_ups"
  ADD CONSTRAINT "event_wrap_ups_deadline_chk" CHECK ("deadline_at" >= "activated_at") NOT VALID;
ALTER TABLE "event_lifecycle"."event_wrap_ups" VALIDATE CONSTRAINT "event_wrap_ups_deadline_chk";

ALTER TABLE "event_lifecycle"."event_freeze_exceptions"
  ADD CONSTRAINT "event_freeze_exceptions_decided_chk" CHECK ("decided_at" IS NULL OR "decided_at" >= "requested_at") NOT VALID;
ALTER TABLE "event_lifecycle"."event_freeze_exceptions" VALIDATE CONSTRAINT "event_freeze_exceptions_decided_chk";

ALTER TABLE "event_lifecycle"."addenda"
  ADD CONSTRAINT "addenda_version_number_chk" CHECK ("version_number" >= 1) NOT VALID;
ALTER TABLE "event_lifecycle"."addenda" VALIDATE CONSTRAINT "addenda_version_number_chk";

