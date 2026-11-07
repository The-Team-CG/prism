-- prism-owner: live-ops
-- prism-kind: mixed
-- prism-risk: medium

ALTER TABLE "live_ops"."event_day_tasks"
    ADD COLUMN "blocked_reason" TEXT,
    ADD COLUMN "blocked_at" TIMESTAMP(3),
    ADD COLUMN "blocked_by" TEXT;

-- Existing blocked tasks keep their notes as the reason when notes hold text.
-- Otherwise they get an explicit marker; blocked_at is the last update that set the blocked status.
UPDATE "live_ops"."event_day_tasks"
SET "blocked_reason" = CASE
        WHEN btrim("notes") <> '' THEN btrim("notes")
        ELSE 'Blocked before reasons were recorded'
    END,
    "blocked_at" = "updated_at"
WHERE "status" = 'blocked';
