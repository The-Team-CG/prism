-- prism-owner: operations
-- prism-kind: data
-- prism-risk: medium

-- Give coordinator assignments whose role is not one of the catalog roles the General Coordinator role.
-- 20261128092000 did this for NULL or blank roles. A custom label (for example "Volunteer Lead") is just as
-- unusable now that the compatibility path is gone: every task create and update from it is refused. Catalog
-- roles are matched the way the API matches them (trimmed, single-spaced, any case), so they are not changed,
-- and the statement is idempotent: a second run matches nothing.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "operations"."coordinator_assignments"
SET "role" = 'General Coordinator'
WHERE "role" IS NOT NULL
  AND LOWER(REGEXP_REPLACE(BTRIM("role"), '\s+', ' ', 'g')) NOT IN (
    'general coordinator',
    'event day system operator',
    'registration staff',
    'floor director',
    'stage director',
    'ingress and egress assistant',
    'usher'
  );

COMMIT;
