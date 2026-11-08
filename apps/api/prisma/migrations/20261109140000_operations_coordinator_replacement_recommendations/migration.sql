-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium

-- FR-AI-04: PARE coordinator mode. An emergency withdrawal raises one replacement package that PMCM approves or rejects.
CREATE TABLE "operations"."coordinator_replacement_recommendations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "withdrawn_assignment_id" TEXT NOT NULL,
    "withdrawn_coordinator_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hours_to_event" INTEGER NOT NULL,
    "risk_level" TEXT NOT NULL,
    "risk_summary" TEXT NOT NULL,
    "candidates" JSONB NOT NULL DEFAULT '[]',
    "draft_message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "selected_coordinator_id" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_replacement_recommendations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coordinator_replacement_recommendations_assignment_key" ON "operations"."coordinator_replacement_recommendations"("withdrawn_assignment_id");

CREATE INDEX "coordinator_replacement_recommendations_event_status_idx" ON "operations"."coordinator_replacement_recommendations"("event_id", "status");
