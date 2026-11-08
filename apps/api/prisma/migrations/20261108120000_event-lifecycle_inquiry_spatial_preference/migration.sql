-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- Optional spatial preference captured on the public inquiry. Existing inquiries carry none.
ALTER TABLE "event_lifecycle"."inquiries"
    ADD COLUMN "seating_arrangement" TEXT,
    ADD COLUMN "stage_position" TEXT,
    ADD COLUMN "setup_notes" TEXT;
