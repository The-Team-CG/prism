-- This opt-in UAT data seed runs only when Talga temporarily sets prism.uat_seed_enabled=true.
-- prism-owner: event-lifecycle
-- prism-kind: data
-- prism-risk: medium

-- Synthetic portal fixtures. The conforme rows are explicitly marked as UAT-only, not legal signatures.
-- Only seed when the known UAT client and PMCM accounts are present; production accounts are never created here.
INSERT INTO event_lifecycle.inquiries (
  id, client_name, company_name, email, event_name, event_type, event_date,
  client_type, source, normalized_email, message, status, accepted_at,
  conforme_sent_at, conforme_signed_at, portal_activated_at,
  privacy_consent_accepted, privacy_notice_version
)
SELECT 'inq_uat_supplier_261121', 'Ana Santos', 'Ayala UAT', 'ana@ayala.test',
       'UAT Operations Supplier Booking 2026', 'Corporate Event', '2026-11-21T00:00:00+08:00'::timestamptz,
       'corporate', 'UAT Seed', 'ana@ayala.test', 'Synthetic UAT fixture for supplier requests, bookings, briefing, and proposal flows.',
       'accepted', now(), now(), now(), now(), true, 'UAT-2026-10'

WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.inquiries (
  id, client_name, company_name, email, event_name, event_type, event_date,
  client_type, source, normalized_email, message, status, accepted_at,
  conforme_sent_at, conforme_signed_at, portal_activated_at,
  privacy_consent_accepted, privacy_notice_version
)
SELECT 'inq_uat_live_261024', 'Ana Santos', 'Ayala UAT', 'ana@ayala.test',
       'UAT Live Ops Event 2026', 'Corporate Event', '2026-10-24T00:00:00+08:00'::timestamptz,
       'corporate', 'UAT Seed', 'ana@ayala.test', 'Synthetic UAT fixture for event-day staffing, guest registration, and event games.',
       'accepted', now(), now(), now(), now(), true, 'UAT-2026-10'

WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.inquiries (
  id, client_name, company_name, email, event_name, event_type, event_date,
  client_type, source, normalized_email, message, status, accepted_at,
  conforme_sent_at, conforme_signed_at, portal_activated_at,
  privacy_consent_accepted, privacy_notice_version
)
SELECT 'inq_uat_feedback_261020', 'Ana Santos', 'Ayala UAT', 'ana@ayala.test',
       'UAT Guest Feedback 2026', 'Corporate Event', '2026-10-20T00:00:00+08:00'::timestamptz,
       'corporate', 'UAT Seed', 'ana@ayala.test', 'Synthetic UAT fixture for recent post-event guest feedback.',
       'accepted', now(), now(), now(), now(), true, 'UAT-2026-10'

WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.inquiries (
  id, client_name, company_name, email, event_name, event_type, event_date,
  client_type, source, normalized_email, message, status, accepted_at,
  conforme_sent_at, conforme_signed_at, portal_activated_at,
  privacy_consent_accepted, privacy_notice_version
)
SELECT 'inq_uat_closure_261019', 'Ana Santos', 'Ayala UAT', 'ana@ayala.test',
       'UAT Closure Event 2026', 'Corporate Event', '2026-10-19T00:00:00+08:00'::timestamptz,
       'corporate', 'UAT Seed', 'ana@ayala.test', 'Synthetic UAT fixture for closeout and archive workflows.',
       'accepted', now(), now(), now(), now(), true, 'UAT-2026-10'

WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.inquiries (
  id, client_name, company_name, email, event_name, event_type, event_date,
  client_type, source, normalized_email, message, status, accepted_at,
  conforme_sent_at, conforme_signed_at, portal_activated_at,
  privacy_consent_accepted, privacy_notice_version
)
SELECT 'inq_uat_archived_260815', 'Ana Santos', 'Ayala UAT', 'ana@ayala.test',
       'UAT Archived Event 2026', 'Corporate Event', '2026-08-15T00:00:00+08:00'::timestamptz,
       'corporate', 'UAT Seed', 'ana@ayala.test', 'Synthetic UAT fixture for archived-event visibility.',
       'accepted', now(), now(), now(), now(), true, 'UAT-2026-10'

WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.events (
  id, inquiry_id, client_name, event_name, event_date, status,
  client_portal_status, readiness, proposal_client_status
)
SELECT 'evt_uat_ops_261121', 'inq_uat_supplier_261121', 'Ana Santos',
       'UAT Operations Supplier Booking 2026', '2026-11-21T00:00:00+08:00'::timestamptz,
       'planning', 'unlocked', 'Conforme complete', 'pending'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.inquiries WHERE id = 'inq_uat_supplier_261121' AND status = 'accepted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.events (
  id, inquiry_id, client_name, event_name, event_date, status,
  client_portal_status, readiness, proposal_client_status
)
SELECT 'evt_uat_live_261024', 'inq_uat_live_261024', 'Ana Santos',
       'UAT Live Ops Event 2026', '2026-10-24T00:00:00+08:00'::timestamptz,
       'planning', 'unlocked', 'Conforme complete', 'pending'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.inquiries WHERE id = 'inq_uat_live_261024' AND status = 'accepted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.events (
  id, inquiry_id, client_name, event_name, event_date, actual_ended_at, status,
  client_portal_status, readiness, proposal_client_status
)
SELECT 'evt_uat_guest_261020', 'inq_uat_feedback_261020', 'Ana Santos',
       'UAT Guest Feedback 2026', '2026-10-20T00:00:00+08:00'::timestamptz,
       '2026-10-20T20:00:00+08:00'::timestamptz, 'completed', 'unlocked', 'Event complete', 'pending'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.inquiries WHERE id = 'inq_uat_feedback_261020' AND status = 'accepted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.events (
  id, inquiry_id, client_name, event_name, event_date, actual_ended_at, status,
  client_portal_status, readiness, proposal_client_status
)
SELECT 'evt_uat_closure_261019', 'inq_uat_closure_261019', 'Ana Santos',
       'UAT Closure Event 2026', '2026-10-19T00:00:00+08:00'::timestamptz,
       '2026-10-19T20:00:00+08:00'::timestamptz, 'completed', 'unlocked', 'Event complete', 'pending'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.inquiries WHERE id = 'inq_uat_closure_261019' AND status = 'accepted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.events (
  id, inquiry_id, client_name, event_name, event_date, actual_ended_at, status,
  client_portal_status, readiness, proposal_client_status, archived, archived_at
)
SELECT 'evt_uat_archived_260815', 'inq_uat_archived_260815', 'Ana Santos',
       'UAT Archived Event 2026', '2026-08-15T00:00:00+08:00'::timestamptz,
       '2026-08-15T20:00:00+08:00'::timestamptz, 'completed', 'unlocked', 'Event complete', 'pending',
       true, '2026-08-16T00:00:00+08:00'::timestamptz
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.inquiries WHERE id = 'inq_uat_archived_260815' AND status = 'accepted')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_executions (
  id, inquiry_id, event_id, template_version, template_content, template_sha256,
  document_content, document_sha256, status, completed_at
)
SELECT 'conf_uat_supplier_261121', 'inq_uat_supplier_261121', 'evt_uat_ops_261121', 1,
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'completed', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_executions (
  id, inquiry_id, event_id, template_version, template_content, template_sha256,
  document_content, document_sha256, status, completed_at
)
SELECT 'conf_uat_live_261024', 'inq_uat_live_261024', 'evt_uat_live_261024', 1,
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'completed', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_live_261024')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_executions (
  id, inquiry_id, event_id, template_version, template_content, template_sha256,
  document_content, document_sha256, status, completed_at
)
SELECT 'conf_uat_feedback_261020', 'inq_uat_feedback_261020', 'evt_uat_guest_261020', 1,
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'completed', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_guest_261020')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_executions (
  id, inquiry_id, event_id, template_version, template_content, template_sha256,
  document_content, document_sha256, status, completed_at
)
SELECT 'conf_uat_closure_261019', 'inq_uat_closure_261019', 'evt_uat_closure_261019', 1,
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'completed', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_closure_261019')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_executions (
  id, inquiry_id, event_id, template_version, template_content, template_sha256,
  document_content, document_sha256, status, completed_at
)
SELECT 'conf_uat_archived_260815', 'inq_uat_archived_260815', 'evt_uat_archived_260815', 1,
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'PRISM UAT conforme fixture v1', 'aaeeff0337aff13c00b1b8f47ac816c38de306a98a6c1a637cff5507b148965d',
       'completed', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_archived_260815')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_signatures (
  id, execution_id, actor_id, actor_role, actor_name, actor_email,
  consent_text_version, consent_text
)
SELECT 'sig_uat_supplier_client', 'conf_uat_supplier_261121', 'usr_client', 'client', 'Ana Santos (UAT fixture)',
       'ana@ayala.test', 'UAT-SEED-ONLY-v1', 'UAT seed record only; this is not a legal signature or client consent.'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.conforme_executions WHERE id = 'conf_uat_supplier_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_signatures (
  id, execution_id, actor_id, actor_role, actor_name, actor_email,
  consent_text_version, consent_text
)
SELECT 'sig_uat_live_client', 'conf_uat_live_261024', 'usr_client', 'client', 'Ana Santos (UAT fixture)',
       'ana@ayala.test', 'UAT-SEED-ONLY-v1', 'UAT seed record only; this is not a legal signature or client consent.'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.conforme_executions WHERE id = 'conf_uat_live_261024')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_signatures (
  id, execution_id, actor_id, actor_role, actor_name, actor_email,
  consent_text_version, consent_text
)
SELECT 'sig_uat_feedback_client', 'conf_uat_feedback_261020', 'usr_client', 'client', 'Ana Santos (UAT fixture)',
       'ana@ayala.test', 'UAT-SEED-ONLY-v1', 'UAT seed record only; this is not a legal signature or client consent.'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.conforme_executions WHERE id = 'conf_uat_feedback_261020')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_signatures (
  id, execution_id, actor_id, actor_role, actor_name, actor_email,
  consent_text_version, consent_text
)
SELECT 'sig_uat_closure_client', 'conf_uat_closure_261019', 'usr_client', 'client', 'Ana Santos (UAT fixture)',
       'ana@ayala.test', 'UAT-SEED-ONLY-v1', 'UAT seed record only; this is not a legal signature or client consent.'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.conforme_executions WHERE id = 'conf_uat_closure_261019')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.conforme_signatures (
  id, execution_id, actor_id, actor_role, actor_name, actor_email,
  consent_text_version, consent_text
)
SELECT 'sig_uat_archived_client', 'conf_uat_archived_260815', 'usr_client', 'client', 'Ana Santos (UAT fixture)',
       'ana@ayala.test', 'UAT-SEED-ONLY-v1', 'UAT seed record only; this is not a legal signature or client consent.'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.conforme_executions WHERE id = 'conf_uat_archived_260815')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.briefings (
  id, event_id, venue, guest_count, budget_range, service_requirements,
  notes, confirmed_date, confirmed_start_time, confirmed_end_time,
  program, mood_and_styling, styling_budget
)
SELECT 'brief_uat_ops_261121_v1', 'evt_uat_ops_261121', 'Function Room A', 120,
       'PHP 1,200,000–1,500,000', '["Catering", "Registration", "Production"]'::jsonb,
       'Seeded first briefing revision for UAT resubmission.', '2026-11-21T00:00:00+08:00'::timestamptz,
       '08:00', '21:00', '[{"time":"08:00","activity":"Registration"},{"time":"10:00","activity":"Program start"}]'::jsonb,
       'Warm modern Filipino; cream and deep green palette.', 180000
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.ocular_visit_requests (id, event_id, status, client_note, requested_at, updated_at)
SELECT 'ocular_uat_ops_261121', 'evt_uat_ops_261121', 'requested',
       'Please confirm an available venue walk-through slot for the UAT event.', now(), now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.scope_change_requests (
  id, event_id, requested_by_role, requested_by, requested_by_id,
  title, description, category, status
)
SELECT 'scope_uat_ops_261121', 'evt_uat_ops_261121', 'client', 'Ana Santos', 'usr_client',
       'Add a second registration desk', 'Please add one staffed registration desk near the north entrance.',
       'operations', 'submitted'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.file_requirements (
  id, event_id, key, label, owner_role, visible_to_roles, required,
  due_at, source_workflow, updated_by
)
SELECT 'file_req_uat_supplier_contract', 'evt_uat_ops_261121', 'supplier_contract',
       'Signed supplier contract', 'supplier', ARRAY['supplier', 'pmcm-admin']::text[], true,
       '2026-11-07T00:00:00+08:00'::timestamptz, 'supplier_booking', 'usr_pmcm'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO event_lifecycle.file_requirements (
  id, event_id, key, label, owner_role, visible_to_roles, required,
  due_at, source_workflow, updated_by
)
SELECT 'file_req_uat_client_floorplan', 'evt_uat_ops_261121', 'client_floorplan_preferences',
       'Client floorplan preferences', 'client', ARRAY['client', 'pmcm-admin']::text[], true,
       '2026-11-10T00:00:00+08:00'::timestamptz, 'floorplan', 'usr_pmcm'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM event_lifecycle.events WHERE id = 'evt_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;
