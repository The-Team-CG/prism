-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: high
-- Keep individual guest consent evidence on roster entries and check-ins.
-- Existing import-level consent columns remain as legacy batch metadata; they
-- are intentionally not promoted or copied as individual guest consent.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "operations"."guest_roster_entries"
    ADD COLUMN "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "privacy_consent_captured_at" TIMESTAMPTZ(6);

COMMIT;
