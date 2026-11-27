-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- UAT 5.3: when the signed conforme activated the client portal. Commercial issues the billing statement from the
-- approved proposal for events with this set and no billing source yet. Nullable: earlier events are not backfilled.
ALTER TABLE "event_lifecycle"."events" ADD COLUMN IF NOT EXISTS "billing_requested_at" TIMESTAMP(3);
