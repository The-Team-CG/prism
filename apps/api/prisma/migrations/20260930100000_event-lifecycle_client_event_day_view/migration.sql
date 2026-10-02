-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- Existing rows become explicitly disabled; only PMCM Admin can enable the
-- client-safe event-day status line for an individual event.
ALTER TABLE "event_core"."events"
  ADD COLUMN "client_event_day_view_enabled" BOOLEAN NOT NULL DEFAULT false;
