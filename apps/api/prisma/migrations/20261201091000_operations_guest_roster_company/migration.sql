-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- UAT 11.1: capture the guest's company name on the roster. Empty for existing rows.
ALTER TABLE "operations"."guest_roster_entries" ADD COLUMN IF NOT EXISTS "company" TEXT NOT NULL DEFAULT '';
