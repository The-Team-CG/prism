-- Phase 8 security, privacy, and audit readiness metadata.

ALTER TABLE "ops_approval_requests"
  ADD COLUMN "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "privacy_notice_version" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ops_inquiries"
  ADD COLUMN "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "privacy_notice_version" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ops_guest_check_ins"
  ADD COLUMN "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "privacy_notice_version" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ops_guest_feedback"
  ADD COLUMN "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "privacy_notice_version" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false;
