-- prism-owner: event-lifecycle
-- prism-kind: data
-- prism-risk: medium

-- UAT 4.1: briefing and proposal now come before the conforme. An accepted inquiry's event workspace opens a
-- "limited" client portal (briefing and proposal only) until the signed conforme unlocks it. Pre-conforme records
-- that already exist for accepted, unsigned inquiries move from "locked" to "limited" so those clients can start.
-- Idempotent: only locked events of accepted, unsigned, active inquiries change.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "event_lifecycle"."events"
SET "client_portal_status" = 'limited',
    "readiness" = CASE WHEN "status" = 'inquiry' THEN 'Client briefing open' ELSE "readiness" END,
    "status" = CASE WHEN "status" = 'inquiry' THEN 'briefing' ELSE "status" END
WHERE "client_portal_status" = 'locked'
  AND "archived" = false
  AND "inquiry_id" IN (
    SELECT "id" FROM "event_lifecycle"."inquiries"
    WHERE "status" = 'accepted' AND "conforme_signed_at" IS NULL
  );

COMMIT;
