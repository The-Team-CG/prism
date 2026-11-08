-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- FR-39 / FR-95: a random QR pass token per roster guest, issued by PMCM. Existing guests carry none.
ALTER TABLE "operations"."guest_roster_entries" ADD COLUMN "check_in_token" TEXT;

CREATE UNIQUE INDEX "guest_roster_entries_check_in_token_key" ON "operations"."guest_roster_entries"("check_in_token");
