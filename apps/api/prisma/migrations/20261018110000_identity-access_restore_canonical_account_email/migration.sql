-- prism-owner: identity-access
-- prism-kind: mixed
-- prism-risk: high

-- Restore canonical account email enforcement. The owner-schema baseline replaced
-- 20261007000000_identity-access_canonical_account_email without carrying its
-- constraints, so fresh databases accepted case variants as distinct identities.
--
-- Existing rows are rewritten to trimmed, lower-case form. If two accounts differ
-- only by case or surrounding space, the rewrite violates users_email_key and the
-- migration aborts naming the colliding address. Accounts are never merged
-- automatically. Databases that still have the original constraints get the
-- same constraints recreated after normalization.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

UPDATE "identity_access"."users"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

UPDATE "identity_access"."approval_requests"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

ALTER TABLE "identity_access"."users"
  DROP CONSTRAINT IF EXISTS "users_email_canonical_chk";
ALTER TABLE "identity_access"."users"
  ADD CONSTRAINT "users_email_canonical_chk"
  CHECK ("email" = lower(btrim("email")) AND "email" <> '');

ALTER TABLE "identity_access"."approval_requests"
  DROP CONSTRAINT IF EXISTS "approval_requests_email_canonical_chk";
ALTER TABLE "identity_access"."approval_requests"
  ADD CONSTRAINT "approval_requests_email_canonical_chk"
  CHECK ("email" = lower(btrim("email")) AND "email" <> '');

COMMIT;
