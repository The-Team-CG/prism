-- prism-owner: platform-ops
-- prism-kind: data
-- prism-risk: medium

-- Self-service privacy requests were filed under the requester's role ("client" or "supplier"). Execution refuses a
-- deletion or correction under those subject types whenever a native account has the email, which is always true for
-- someone who filed their own, so approved requests could never be carried out. They are about the requester's own
-- account: file them under the "account" subject that execution accepts.
-- Idempotent: rows already filed under "account" are untouched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "platform_ops"."privacy_requests"
SET "subject_type" = 'account'
WHERE "source" = 'self_service'
  AND "subject_type" IN ('client', 'supplier');

COMMIT;
