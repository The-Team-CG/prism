-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- One event-scoped record represents both the client's ocular visit request
-- and the PMCM task; requested_at stays nullable for a waiver without a request.
CREATE TABLE "event_core"."ocular_visit_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "client_note" TEXT,
    "requested_at" TIMESTAMP(3),
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "waiver_reason" TEXT,
    "waived_at" TIMESTAMP(3),
    "waived_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocular_visit_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ocular_visit_requests_event_id_key"
    ON "event_core"."ocular_visit_requests"("event_id");
CREATE INDEX "ocular_visit_requests_status_requested_at_idx"
    ON "event_core"."ocular_visit_requests"("status", "requested_at");

ALTER TABLE "event_core"."ocular_visit_requests"
    ADD CONSTRAINT "ocular_visit_requests_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
