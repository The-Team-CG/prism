-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "operations"."guest_roster_entries"
    ADD COLUMN "verification_flagged_at" TIMESTAMP(3),
    ADD COLUMN "verification_flagged_by" TEXT;

ALTER TABLE "operations"."registration_platforms"
    ADD COLUMN "setup_requested_at" TIMESTAMPTZ(6);
