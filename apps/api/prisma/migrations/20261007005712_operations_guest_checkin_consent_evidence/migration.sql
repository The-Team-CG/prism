-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium
ALTER TABLE "operations"."check_ins"
    ADD COLUMN "privacy_consent_captured_at" TIMESTAMPTZ(6);

ALTER TABLE "operations"."guest_roster_imports"
    ADD COLUMN "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "privacy_consent_captured_at" TIMESTAMPTZ(6);
