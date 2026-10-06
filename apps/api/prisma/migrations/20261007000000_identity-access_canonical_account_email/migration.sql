-- prism-owner: identity-access
-- prism-kind: mixed
-- prism-risk: medium

-- Canonical account email: trimmed and lower-cased. Case variants must never be distinct identities.
--
-- Existing rows are rewritten to canonical form. If two accounts differ only by case or surrounding space, the
-- rewrite violates users_email_key and this migration aborts with a unique violation naming the colliding
-- address. Accounts are never merged automatically: resolve the collision by disabling or re-addressing one
-- account, then re-run the migration.
UPDATE "identity_access"."users"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

UPDATE "identity_access"."approval_requests"
SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));

ALTER TABLE "identity_access"."users"
  ADD CONSTRAINT "users_email_canonical_chk"
  CHECK ("email" = lower(btrim("email")) AND "email" <> '');

ALTER TABLE "identity_access"."approval_requests"
  ADD CONSTRAINT "approval_requests_email_canonical_chk"
  CHECK ("email" = lower(btrim("email")) AND "email" <> '');
