-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- AddColumn: when PMCM started event day. Event day may start ahead of the event date, so the recorded actual end is
-- checked against this instead of the date. Nullable: events that started before it was recorded keep no start time.
ALTER TABLE "event_lifecycle"."events" ADD COLUMN "actual_started_at" TIMESTAMP(3);
