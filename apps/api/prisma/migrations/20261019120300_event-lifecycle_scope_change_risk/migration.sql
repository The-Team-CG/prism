-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- FL-025 scope change requests and the PMCM event risk assessment with its revision history. Additive tables only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateTable
CREATE TABLE "event_lifecycle"."scope_change_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "requested_by_role" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_by_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "decision_reason" TEXT,
    "client_response" TEXT,
    "billing_impact" BOOLEAN NOT NULL DEFAULT false,
    "supplier_impact" BOOLEAN NOT NULL DEFAULT false,
    "coordinator_impact" BOOLEAN NOT NULL DEFAULT false,
    "floorplan_impact" BOOLEAN NOT NULL DEFAULT false,
    "impact_reviewed_at" TIMESTAMP(3),
    "freeze_exception_id" TEXT,
    "addendum_id" TEXT,
    "reviewed_by" TEXT,
    "decided_by" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "review_started_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scope_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."event_risk_assessments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "mitigations" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "assessed_by" TEXT NOT NULL,
    "assessed_by_id" TEXT,
    "assessed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_lifecycle"."event_risk_assessment_history" (
    "id" TEXT NOT NULL,
    "assessment_id" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "previous_level" TEXT,
    "suggested_level" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "mitigations" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "assessed_by" TEXT NOT NULL,
    "assessed_by_id" TEXT,
    "assessed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_risk_assessment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scope_change_requests_event_status_submitted_idx" ON "event_lifecycle"."scope_change_requests"("event_id", "status", "submitted_at");

-- CreateIndex
CREATE INDEX "scope_change_requests_addendum_id_idx" ON "event_lifecycle"."scope_change_requests"("addendum_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_risk_assessments_event_id_key" ON "event_lifecycle"."event_risk_assessments"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_risk_assessment_history_assessment_revision_key" ON "event_lifecycle"."event_risk_assessment_history"("assessment_id", "revision");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."scope_change_requests" ADD CONSTRAINT "scope_change_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."scope_change_requests" ADD CONSTRAINT "scope_change_requests_addendum_id_fkey" FOREIGN KEY ("addendum_id") REFERENCES "event_lifecycle"."addenda"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."event_risk_assessments" ADD CONSTRAINT "event_risk_assessments_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."event_risk_assessment_history" ADD CONSTRAINT "event_risk_assessment_history_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "event_lifecycle"."event_risk_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
