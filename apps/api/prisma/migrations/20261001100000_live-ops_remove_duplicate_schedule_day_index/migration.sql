-- prism-owner: live-ops
-- prism-kind: schema
-- prism-risk: medium
-- The unique event/date key remains and covers the removed duplicate index.
DROP INDEX IF EXISTS "staffing_ops"."event_schedule_days_event_id_day_date_idx";
