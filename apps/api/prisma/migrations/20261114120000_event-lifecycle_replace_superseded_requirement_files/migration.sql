-- prism-owner: event-lifecycle
-- prism-kind: data
-- prism-risk: medium

-- A new upload for a file requirement now marks the sender's earlier unreviewed files "replaced", so only the newest
-- one waits for PMCM's review and appears in the command inbox. This applies the same rule to files sent before the
-- change, for client and coordinator uploads: an unreviewed file is replaced when the same role sent a newer file for
-- the same custom requirement. Supplier uploads are left as they are, because which supplier sent a file is recorded
-- only in platform-ops storage. Only the status changes; no rows are deleted.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "event_lifecycle"."documents"
SET "status" = 'replaced'
WHERE "status" = 'submitted'
  AND "storage_key" IS NOT NULL
  AND "uploaded_by_role" IN ('client', 'coordinator')
  AND ("event_id", "type") IN (SELECT "event_id", "key" FROM "event_lifecycle"."file_requirements" WHERE "is_custom")
  -- Keeps the newest file per event, requirement and sending role, ordered the way the requirement history is.
  AND "id" NOT IN (
    SELECT DISTINCT ON ("event_id", "type", "uploaded_by_role") "id"
    FROM "event_lifecycle"."documents"
    WHERE "storage_key" IS NOT NULL AND "uploaded_by_role" IN ('client', 'coordinator')
    ORDER BY "event_id", "type", "uploaded_by_role", "uploaded_at" DESC, "id" ASC
  );

COMMIT;
