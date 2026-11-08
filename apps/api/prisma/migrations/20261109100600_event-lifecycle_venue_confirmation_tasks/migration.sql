-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-97: each postponement opens a sub-ticket for PMCM to confirm the venue for the new date.
CREATE TABLE "event_lifecycle"."venue_confirmation_tasks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "decision_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "new_event_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,

    CONSTRAINT "venue_confirmation_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "venue_confirmation_tasks_decision_key" ON "event_lifecycle"."venue_confirmation_tasks"("decision_id");

CREATE INDEX "venue_confirmation_tasks_event_status_idx" ON "event_lifecycle"."venue_confirmation_tasks"("event_id", "status");
