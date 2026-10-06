-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
ALTER TABLE "event_lifecycle"."events"
    ADD COLUMN "guest_privacy_classification" TEXT NOT NULL DEFAULT 'unclassified';

ALTER TABLE "event_lifecycle"."events"
    ADD CONSTRAINT "events_guest_privacy_classification_check"
    CHECK ("guest_privacy_classification" IN ('private', 'public', 'unclassified'));
