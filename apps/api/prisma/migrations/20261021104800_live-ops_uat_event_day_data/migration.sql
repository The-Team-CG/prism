-- This opt-in UAT data seed runs only when Talga temporarily sets prism.uat_seed_enabled=true.
-- prism-owner: live-ops
-- prism-kind: data
-- prism-risk: medium

INSERT INTO live_ops.event_day_tasks (
  id, event_id, title, assigned_role, owner_name, priority, status, notes, due_at
)
SELECT
  'task_uat_live_registration', 'evt_uat_live_261024', 'Confirm registration desk readiness',
  'Event Coordinator', 'Marco Dela Cruz', 'high', 'open',
  'Check scanners, guest list, and north entrance signage.', '2026-10-24T07:30:00+08:00'::timestamptz
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO live_ops.event_schedule_days (id, event_id, day_date, label)
SELECT 'schedule_day_uat_live', 'evt_uat_live_261024', '2026-10-24', 'Main event day'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO live_ops.event_schedule_segments (
  id, day_id, sequence, title, planned_start_at, planned_end_at, owner_role, location
)
SELECT
  'schedule_segment_uat_live_opening', 'schedule_day_uat_live', 1, 'Guest registration and welcome',
  '2026-10-24T08:00:00+08:00'::timestamptz, '2026-10-24T09:30:00+08:00'::timestamptz,
  'Event Coordinator', 'North entrance'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM live_ops.event_schedule_days WHERE id = 'schedule_day_uat_live')
ON CONFLICT (id) DO NOTHING;

INSERT INTO live_ops.event_operator_designations (id, event_id, coordinator_id, designated_by)
SELECT 'operator_uat_live_marco', 'evt_uat_live_261024', 'coord_marco', 'usr_pmcm'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;
