-- prism-owner: live-ops
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "live_ops"."event_eod_reports"
    ADD COLUMN "incomplete_tasks_flagged_at" TIMESTAMP(3),
    ADD COLUMN "incomplete_tasks_flagged_by" TEXT;
