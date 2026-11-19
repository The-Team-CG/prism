-- prism-owner: event-lifecycle
-- prism-kind: data
-- prism-risk: medium

-- Rewrite the retired inquiry client category "Private" to "Individual" (product policy 2026-09-08).
-- The API no longer maps the value on write, so every stored legacy row must read as a current category.
-- Idempotent: rows already set to "Individual" are untouched. School and Other stay historical values.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "event_lifecycle"."inquiries"
SET "client_type" = 'Individual'
WHERE BTRIM("client_type") = 'Private';

COMMIT;
