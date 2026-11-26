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

UPDATE "event_lifecycle"."events" AS e
SET "client_portal_status" = 'limited',
    "status" = CASE WHEN e."status" = 'inquiry' THEN 'briefing' ELSE e."status" END,
    "readiness" = CASE WHEN e."status" = 'inquiry' THEN 'Client briefing open' ELSE e."readiness" END
FROM "event_lifecycle"."inquiries" AS i
WHERE e."inquiry_id" = i."id"
  AND e."client_portal_status" = 'locked'
  AND e."archived" = false
  AND i."status" = 'accepted'
  AND i."conforme_signed_at" IS NULL;

COMMIT;
