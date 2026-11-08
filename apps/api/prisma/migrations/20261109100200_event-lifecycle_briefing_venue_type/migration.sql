-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- Venue kind on the briefing, shown to suppliers on quote requests (FR-36/FR-49). Existing briefings carry none.
ALTER TABLE "event_lifecycle"."briefings" ADD COLUMN "venue_type" TEXT;
