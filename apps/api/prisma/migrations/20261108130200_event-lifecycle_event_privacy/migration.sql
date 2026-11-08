-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- Touches only event_lifecycle.events. Existing events default to private, the only setting that keeps seating available.
-- AlterTable
ALTER TABLE "event_lifecycle"."events" ADD COLUMN "privacy" TEXT NOT NULL DEFAULT 'private';
