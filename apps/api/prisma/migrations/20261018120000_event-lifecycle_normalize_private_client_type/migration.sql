-- prism-owner: event-lifecycle
-- prism-kind: data
-- prism-risk: low

-- Normalize the legacy inquiry client category "Private" to "Individual" (product
-- policy 2026-09-08). Only the exact legacy value is rewritten. School and Other
-- values are historical and stay unchanged; no rows are deleted.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "event_lifecycle"."inquiries"
SET "client_type" = 'Individual'
WHERE "client_type" = 'Private';

COMMIT;
