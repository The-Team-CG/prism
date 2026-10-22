-- This opt-in UAT data seed runs only when Talga temporarily sets prism.uat_seed_enabled=true.
-- prism-owner: operations
-- prism-kind: data
-- prism-risk: medium

INSERT INTO operations.guest_roster_entries (
  id, event_id, source_key, guest_name, normalized_name, email, category, "table",
  eligibility, verification_status, source, privacy_consent_accepted, privacy_notice_version, updated_at
)
SELECT 'roster_uat_live_sofia', 'evt_uat_live_261024', 'uat-sofia-lim', 'Sofia Lim', 'sofia lim',
       'sofia.lim@example.test', 'VIP', 'Table 1', 'eligible', 'pending', 'manual', false, 'UAT-2026-10', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.guest_roster_entries (
  id, event_id, source_key, guest_name, normalized_name, email, category, "table",
  eligibility, verification_status, source, privacy_consent_accepted, privacy_notice_version,
  privacy_consent_captured_at, checked_in_at, updated_at
)
SELECT 'roster_uat_live_diego', 'evt_uat_live_261024', 'uat-diego-ramos', 'Diego Ramos', 'diego ramos',
       'diego.ramos@example.test', 'General', 'Table 4', 'eligible', 'verified', 'manual', true,
       'UAT-2026-10', now() - interval '1 hour', now() - interval '1 hour', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.guest_roster_entries (
  id, event_id, source_key, guest_name, normalized_name, email, category,
  eligibility, verification_status, source, privacy_consent_accepted, privacy_notice_version, updated_at
)
SELECT 'roster_uat_feedback_maya', 'evt_uat_guest_261020', 'uat-maya-cruz', 'Maya Cruz', 'maya cruz',
       'maya.cruz@example.test', 'General', 'eligible', 'verified', 'manual', true, 'UAT-2026-10', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.guest_roster_entries (
  id, event_id, source_key, guest_name, normalized_name, email, category,
  eligibility, verification_status, source, privacy_consent_accepted, privacy_notice_version, updated_at
)
SELECT 'roster_uat_feedback_noel', 'evt_uat_guest_261020', 'uat-noel-reyes', 'Noel Reyes', 'noel reyes',
       'noel.reyes@example.test', 'General', 'eligible', 'verified', 'manual', true, 'UAT-2026-10', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.check_ins (
  id, event_id, roster_entry_id, guest_name, check_in_mode, status, walk_in,
  verification_status, privacy_consent_accepted, privacy_notice_version,
  privacy_consent_captured_at, checked_in_at
)
SELECT 'checkin_uat_live_diego', 'evt_uat_live_261024', 'roster_uat_live_diego', 'Diego Ramos',
       'name_search', 'checked_in', false, 'verified', true, 'UAT-2026-10',
       now() - interval '1 hour', now() - interval '1 hour'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.guest_roster_entries WHERE id = 'roster_uat_live_diego')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.feedback (id, event_id, guest_name, rating, comment, privacy_consent_accepted, privacy_notice_version, moderation_status)
SELECT 'feedback_uat_guest_existing', 'evt_uat_guest_261020', 'Noel Reyes', 5,
       'UAT fixture feedback awaiting PMCM moderation.', true, 'UAT-2026-10', 'pending_review'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.guest_roster_entries WHERE id = 'roster_uat_feedback_noel')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.registration_platforms (
  id, event_id, platform_type, supplier_id, expected_pax_min, expected_pax_max, status, setup_notes, updated_at
)
SELECT 'registration_uat_live_261024', 'evt_uat_live_261024', 'xperto', 'sup_xperto', 100, 150,
       'not_started', 'UAT registration setup; confirm headcount and import a roster from the event portal.', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.event_coverage_requirements (id, event_id, role, required, required_skills, created_by, updated_by, updated_at)
SELECT 'coverage_uat_live_coord', 'evt_uat_live_261024', 'Event Coordinator', 1,
       ARRAY['event-day', 'vendor-coordination']::text[], 'usr_pmcm', 'usr_pmcm', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.event_coverage_requirements (id, event_id, role, required, required_skills, created_by, updated_by, updated_at)
SELECT 'coverage_uat_live_registration', 'evt_uat_live_261024', 'Registration Staff', 2,
       ARRAY['guest-check-in']::text[], 'usr_pmcm', 'usr_pmcm', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.coordinator_assignments (
  id, event_id, coordinator_id, coordinator_name, role, status, attendance_status,
  event_date, acknowledged_at, acknowledged_by, acknowledgement_reason
)
SELECT 'coord_asg_uat_live_marco', 'evt_uat_live_261024', 'coord_marco', 'Marco Dela Cruz',
       'Event Coordinator', 'acknowledged', 'pending', '2026-10-24T00:00:00+08:00'::timestamptz,
       now(), 'usr_coord', 'Acknowledged UAT fixture assignment.'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.coordinator_assignments (
  id, event_id, coordinator_id, coordinator_name, role, status, attendance_status, event_date
)
SELECT 'coord_asg_uat_live_bianca', 'evt_uat_live_261024', 'coord_bianca', 'Bianca Reyes',
       'Registration Staff', 'pending_acknowledgement', 'pending', '2026-10-24T00:00:00+08:00'::timestamptz
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_bianca' AND active = true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO operations.coordinator_assignments (
  id, event_id, coordinator_id, coordinator_name, role, status, attendance_status,
  event_date, acknowledged_at, acknowledged_by, acknowledgement_reason
)
SELECT 'coord_asg_uat_archived_marco', 'evt_uat_archived_260815', 'coord_marco', 'Marco Dela Cruz',
       'Event Coordinator', 'acknowledged', 'present', '2026-08-15T00:00:00+08:00'::timestamptz,
       '2026-08-15T08:00:00+08:00'::timestamptz, 'usr_coord', 'Archived UAT event attendance.'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM operations.coordinators WHERE id = 'coord_marco' AND user_id = 'usr_coord')
ON CONFLICT (id) DO NOTHING;
