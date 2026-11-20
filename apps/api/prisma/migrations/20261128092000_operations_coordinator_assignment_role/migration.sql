-- prism-owner: operations
-- prism-kind: data
-- prism-risk: medium

-- Give coordinator assignments that have no role (NULL or blank) the General Coordinator role.
-- Such rows previously could create event-day tasks for their own queue through a compatibility path that is
-- now removed, so the role is written here. Assignments with a non-blank role are not changed, and the
-- statement is idempotent: rows that already have a role are not matched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "operations"."coordinator_assignments"
SET "role" = 'General Coordinator'
WHERE "role" IS NULL OR BTRIM("role") = '';

COMMIT;
