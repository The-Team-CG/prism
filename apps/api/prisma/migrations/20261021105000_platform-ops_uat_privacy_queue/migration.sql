-- This opt-in UAT data seed runs only when Talga temporarily sets prism.uat_seed_enabled=true.
-- prism-owner: platform-ops
-- prism-kind: data
-- prism-risk: medium

INSERT INTO platform_ops.privacy_requests (
  id, subject_type, subject_email, subject_name, request_type,
  request_notes, created_by, due_at, assigned_to
)
SELECT
  'privacy_uat_guest_access', 'guest', 'uat.guest@example.test', 'UAT Guest', 'access',
  'Synthetic UAT request for access review and export workflow.', 'usr_pmcm', now() + interval '30 days', 'usr_pmcm'

WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_ops.privacy_requests (
  id, subject_type, subject_email, subject_name, request_type,
  request_notes, created_by, due_at
)
SELECT
  'privacy_uat_guest_deletion', 'guest', 'uat.guest2@example.test', 'UAT Guest Two', 'deletion',
  'Synthetic UAT request for deletion review and execution workflow.', 'usr_pmcm', now() + interval '30 days'

WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;
