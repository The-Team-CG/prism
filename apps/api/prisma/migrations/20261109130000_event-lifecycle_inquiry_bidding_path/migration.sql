-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-02: PMCM tracks inquiries that come in as a bid or pitch apart from the standard path.
ALTER TABLE "event_lifecycle"."inquiries"
    ADD COLUMN "intake_path" TEXT NOT NULL DEFAULT 'standard',
    ADD COLUMN "bid_status" TEXT,
    ADD COLUMN "bid_due_at" TIMESTAMP(3);
