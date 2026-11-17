-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

-- AlterTable: an authenticator a signed-in person is adding but has not confirmed with a code yet. Two-step sign-in
-- turns on only when a code from it is confirmed, which moves it to two_factor_secret.
ALTER TABLE "identity_access"."users" ADD COLUMN "two_factor_pending_secret" TEXT;
