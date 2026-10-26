-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

-- AlterTable: null means the account has never acknowledged a privacy notice version.
ALTER TABLE "identity_access"."users"
    ADD COLUMN "privacy_notice_version" TEXT,
    ADD COLUMN "privacy_notice_acknowledged_at" TIMESTAMP(3);
