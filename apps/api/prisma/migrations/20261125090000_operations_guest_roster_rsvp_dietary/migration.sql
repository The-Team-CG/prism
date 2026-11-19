-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- Touches only the operations guest roster. Expand-only: existing guests read as pending with no dietary needs.
-- AlterTable
ALTER TABLE "operations"."guest_roster_entries" ADD COLUMN "rsvp" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN "dietary" TEXT NOT NULL DEFAULT '';
