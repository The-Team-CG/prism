-- prism-owner: event-lifecycle
-- prism-kind: data
-- prism-risk: medium

-- Rename the inquiry client category "Non-profit" to "Organization" (product decision 2026-11-27, UAT 3.3).
-- The shared schema accepts only "Organization" on write, so stored rows must read as the current category.
-- Idempotent: rows already set to "Organization" are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "event_lifecycle"."inquiries"
SET "client_type" = 'Organization'
WHERE BTRIM("client_type") = 'Non-profit';

COMMIT;
