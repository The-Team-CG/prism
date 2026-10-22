-- This opt-in UAT data seed runs only when Talga temporarily sets prism.uat_seed_enabled=true.
-- prism-owner: commercial
-- prism-kind: data
-- prism-risk: medium

INSERT INTO commercial.quote_requests (
  id, event_id, supplier_id, category_id, supplier_name, category, message, due_date, access_token, status
)
SELECT 'rq_uat_xperto_submit', 'evt_uat_ops_261121', 'sup_xperto', 'supcat_digital_registration',
       'XPERTO Registration', 'Digital Registration', 'Submit an initial registration proposal for this UAT event.',
       '2026-11-01T00:00:00+08:00'::timestamptz, replace(gen_random_uuid()::text, '-', ''), 'open'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_xperto')
  AND EXISTS (SELECT 1 FROM commercial.supplier_categories WHERE id = 'supcat_digital_registration')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.quote_requests (
  id, event_id, supplier_id, category_id, supplier_name, category, message, due_date, access_token, status
)
SELECT 'rq_uat_xperto_revision', 'evt_uat_ops_261121', 'sup_xperto', 'supcat_digital_registration',
       'XPERTO Registration', 'Digital Registration', 'Revise the seeded quote to test supplier resubmission and history.',
       '2026-11-02T00:00:00+08:00'::timestamptz, replace(gen_random_uuid()::text, '-', ''), 'open'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_xperto')
  AND EXISTS (SELECT 1 FROM commercial.supplier_categories WHERE id = 'supcat_digital_registration')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.quote_requests (
  id, event_id, supplier_id, category_id, supplier_name, category, message, due_date, access_token, status
)
SELECT 'rq_uat_xperto_selected', 'evt_uat_ops_261121', 'sup_xperto', 'supcat_digital_registration',
       'XPERTO Registration', 'Digital Registration', 'Selected UAT supplier booking awaiting supplier confirmation.',
       '2026-11-03T00:00:00+08:00'::timestamptz, replace(gen_random_uuid()::text, '-', ''), 'selected'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_xperto')
  AND EXISTS (SELECT 1 FROM commercial.supplier_categories WHERE id = 'supcat_digital_registration')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.quote_requests (
  id, event_id, supplier_id, category_id, supplier_name, category, message, due_date, access_token,
  status, assignment_status, assignment_confirmed_at
)
SELECT 'rq_uat_bloom_confirmed', 'evt_uat_ops_261121', 'sup_bloom', 'supcat_production',
       'Bloom Florals', 'Production', 'Confirmed UAT booking with schedule, creative task, and payable milestone.',
       '2026-11-03T00:00:00+08:00'::timestamptz, replace(gen_random_uuid()::text, '-', ''),
       'selected', 'confirmed', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_bloom')
  AND EXISTS (SELECT 1 FROM commercial.supplier_categories WHERE id = 'supcat_production')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.quote_requests (
  id, event_id, supplier_id, category_id, supplier_name, category, message, due_date, access_token,
  status, assignment_status, assignment_confirmed_at
)
SELECT 'rq_uat_bloom_closed', 'evt_uat_ops_261121', 'sup_bloom', 'supcat_production',
       'Bloom Florals', 'Production', 'Closed UAT request for supplier read-only history checks.',
       '2026-11-03T00:00:00+08:00'::timestamptz, replace(gen_random_uuid()::text, '-', ''),
       'closed', 'confirmed', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_bloom')
  AND EXISTS (SELECT 1 FROM commercial.supplier_categories WHERE id = 'supcat_production')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.quotes (
  id, event_id, request_id, supplier_id, category_id, supplier_name, category, amount,
  inclusions, payment_terms, notes, status, revision_number, updated_at
)
SELECT 'quote_uat_xperto_revision_1', 'evt_uat_ops_261121', 'rq_uat_xperto_revision',
       'sup_xperto', 'supcat_digital_registration', 'XPERTO Registration', 'Digital Registration', 420000,
       '["Online registration portal", "On-site check-in team"]'::jsonb, '50% upon confirmation; balance after event',
       'Seeded submitted quote; supplier can revise from the XPERTO portal.', 'submitted', 1, now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.quote_requests WHERE id = 'rq_uat_xperto_revision')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.quotes (
  id, event_id, request_id, supplier_id, category_id, supplier_name, category, amount,
  inclusions, payment_terms, notes, status, revision_number, selected_at, updated_at
)
SELECT 'quote_uat_xperto_selected', 'evt_uat_ops_261121', 'rq_uat_xperto_selected',
       'sup_xperto', 'supcat_digital_registration', 'XPERTO Registration', 'Digital Registration', 485000,
       '["Registration portal", "QR check-in", "Post-event attendance report"]'::jsonb,
       '50% deposit; balance after event', 'Seeded selected proposal awaiting supplier confirmation.',
       'selected', 1, now(), now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.quote_requests WHERE id = 'rq_uat_xperto_selected')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.quotes (
  id, event_id, request_id, supplier_id, category_id, supplier_name, category, amount,
  inclusions, payment_terms, notes, status, revision_number, selected_at, updated_at
)
SELECT 'quote_uat_bloom_confirmed', 'evt_uat_ops_261121', 'rq_uat_bloom_confirmed',
       'sup_bloom', 'supcat_production', 'Bloom Florals', 'Production', 180000,
       '["Stage florals", "Guest table arrangements", "Setup and strike"]'::jsonb,
       '50% deposit; balance after event', 'Seeded confirmed booking quote.', 'selected', 1, now(), now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.quote_requests WHERE id = 'rq_uat_bloom_confirmed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.supplier_schedules (
  id, event_id, request_id, ingress_at, egress_at, location, notes, status, updated_at
)
SELECT 'schedule_uat_bloom_261121', 'evt_uat_ops_261121', 'rq_uat_bloom_confirmed',
       '2026-11-21T07:00:00+08:00'::timestamptz, '2026-11-21T21:00:00+08:00'::timestamptz,
       'Function Room A', 'Acknowledge this planned supplier ingress and egress schedule.', 'planned', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.quote_requests WHERE id = 'rq_uat_bloom_confirmed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.supplier_creative_tasks (
  id, event_id, request_id, supplier_id, title, brief, due_at, status,
  supplier_progress_note, created_by, updated_at
)
SELECT 'creative_uat_bloom_261121', 'evt_uat_ops_261121', 'rq_uat_bloom_confirmed', 'sup_bloom',
       'Submit floral mood board', 'Upload a revised visual direction for stage and guest table florals.',
       '2026-11-10T00:00:00+08:00'::timestamptz, 'open', '', 'usr_pmcm', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.quote_requests WHERE id = 'rq_uat_bloom_confirmed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.supplier_payable_milestones (
  id, event_id, request_id, quote_id, supplier_id, label, amount, due_date, status, created_by, updated_at
)
SELECT 'payable_uat_bloom_deposit', 'evt_uat_ops_261121', 'rq_uat_bloom_confirmed',
       'quote_uat_bloom_confirmed', 'sup_bloom', 'Floral production deposit', 90000,
       '2026-11-07T00:00:00+08:00'::timestamptz, 'scheduled', 'usr_pmcm', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.quotes WHERE id = 'quote_uat_bloom_confirmed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.supplier_applications (
  id, company_name, contact_name, email, normalized_email, phone, category_id,
  past_events, service_inclusions, price_range, additional_notes, status,
  privacy_consent_accepted, privacy_notice_version, updated_at
)
SELECT 'application_uat_northstar', 'Northstar UAT Logistics', 'Riley Santos',
       'riley@northstar-uat.example', 'riley@northstar-uat.example', '+63 917 555 0142',
       'supcat_production', 'UAT event logistics and technical production',
       'Venue setup, staging, and event-day crew', 'PHP 80,000–220,000',
       'Synthetic supplier application for PMCM review.', 'pending', true, 'UAT-2026-10', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.supplier_categories WHERE id = 'supcat_production')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.cost_estimates (id, event_id, budget_amount, total_amount, status, notes, updated_at)
SELECT 'estimate_uat_ops_261121', 'evt_uat_ops_261121', 1500000, 865000, 'ready',
       'Synthetic proposal estimate for client approval and revision tests.', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_xperto')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.cost_estimate_lines (id, estimate_id, category, description, quantity, unit_amount, total_amount)
SELECT 'estimate_line_uat_ops_registration', 'estimate_uat_ops_261121', 'Digital Registration',
       'Registration portal and check-in support', 1.000, 485000, 485000
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.cost_estimates WHERE id = 'estimate_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.cost_estimate_lines (id, estimate_id, category, description, quantity, unit_amount, total_amount)
SELECT 'estimate_line_uat_ops_production', 'estimate_uat_ops_261121', 'Production',
       'Floral design, setup, and strike', 1.000, 380000, 380000
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.cost_estimates WHERE id = 'estimate_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.proposal_versions (
  id, event_id, cost_estimate_id, version_number, title, summary, total_amount, status, issued_at
)
SELECT 'proposal_uat_ops_v1', 'evt_uat_ops_261121', 'estimate_uat_ops_261121', 1,
       'UAT Operations Event Proposal', 'Seeded proposal ready for Ana to approve or request a revision.',
       865000, 'issued', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.cost_estimates WHERE id = 'estimate_uat_ops_261121')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.client_review_items (
  id, event_id, kind, title, summary, version, status, budget_range, created_by, published_at, updated_at
)
SELECT 'review_uat_venue_v1', 'evt_uat_ops_261121', 'venue', 'Function Room A',
       'Accessible ballroom with a north entrance and built-in stage.', 1, 'published',
       'PHP 280,000–340,000', 'usr_pmcm', now(), now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_xperto')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.client_review_items (
  id, event_id, kind, title, summary, version, status, budget_range, created_by, published_at, updated_at
)
SELECT 'review_uat_styling_v1', 'evt_uat_ops_261121', 'styling', 'Warm modern Filipino',
       'Cream and deep green palette with locally sourced flowers.', 1, 'published',
       'PHP 150,000–220,000', 'usr_pmcm', now(), now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_bloom')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.communication_threads (id, event_id, subject, created_by, updated_at)
SELECT 'thread_uat_ops_supplier', 'evt_uat_ops_261121', 'UAT supplier and event coordination', 'usr_pmcm', now()
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.suppliers WHERE id = 'sup_bloom')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.communication_participants (id, thread_id, actor_id, actor_role, actor_email)
SELECT 'participant_uat_ops_pmcm', 'thread_uat_ops_supplier', 'usr_pmcm', 'pmcm-admin', 'mys@pmcm.test'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.communication_threads WHERE id = 'thread_uat_ops_supplier')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.communication_participants (id, thread_id, actor_id, actor_role, actor_email)
SELECT 'participant_uat_ops_client', 'thread_uat_ops_supplier', 'usr_client', 'client', 'ana@ayala.test'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.communication_threads WHERE id = 'thread_uat_ops_supplier')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.communication_participants (id, thread_id, actor_id, actor_role, actor_email)
SELECT 'participant_uat_ops_bloom', 'thread_uat_ops_supplier', 'usr_supplier_bloom', 'supplier', 'flowers@bloom.test'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.communication_threads WHERE id = 'thread_uat_ops_supplier')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.communication_messages (id, thread_id, sender_id, sender_role, sender_email, body, payload_hash, idempotency_key)
SELECT 'message_uat_ops_pmcm', 'thread_uat_ops_supplier', 'usr_pmcm', 'pmcm-admin', 'mys@pmcm.test',
       'Seeded UAT coordination notes', 'c7ac27c464e087766f12edcae53cd4f74faf5adf38041f005463e127415694cd', 'uat-seed-pmcm-v1'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.communication_threads WHERE id = 'thread_uat_ops_supplier')
ON CONFLICT (id) DO NOTHING;

INSERT INTO commercial.communication_messages (id, thread_id, sender_id, sender_role, sender_email, body, payload_hash, idempotency_key)
SELECT 'message_uat_ops_client', 'thread_uat_ops_supplier', 'usr_client', 'client', 'ana@ayala.test',
       'Seeded UAT client reply', '44bd276bf1cdf9582585638177780c9eaec675a8ecc01e86ee7961e72ae507a5', 'uat-seed-client-v1'
WHERE current_setting('prism.uat_seed_enabled', true) = 'true'
  AND EXISTS (SELECT 1 FROM commercial.communication_threads WHERE id = 'thread_uat_ops_supplier')
ON CONFLICT (id) DO NOTHING;
