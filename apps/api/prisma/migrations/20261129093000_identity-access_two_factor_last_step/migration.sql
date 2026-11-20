-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

-- AlterTable: the time step of the last authenticator code accepted for the account. A code from that step or an
-- earlier one is refused, so a code seen over someone's shoulder cannot be used again within its window.
ALTER TABLE "identity_access"."users" ADD COLUMN "two_factor_last_step" INTEGER;
