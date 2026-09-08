CREATE TABLE "staffing_ops"."coordinator_availability" (
    "id" TEXT NOT NULL,
    "coordinator_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'unavailable',
    "note" TEXT NOT NULL DEFAULT '',
    "declared_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coordinator_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staffing_ops"."event_coverage_requirements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "required" INTEGER NOT NULL,
    "required_skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "event_coverage_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staffing_ops"."coordinator_assignment_acknowledgments" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coordinator_assignment_acknowledgments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "staffing_ops"."coordinator_availability"
    ADD CONSTRAINT "coordinator_availability_coordinator_id_fkey"
    FOREIGN KEY ("coordinator_id") REFERENCES "staffing_ops"."coordinators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_ops"."event_coverage_requirements"
    ADD CONSTRAINT "event_coverage_requirements_event_id_fkey"
    FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staffing_ops"."coordinator_assignment_acknowledgments"
    ADD CONSTRAINT "coordinator_assignment_acknowledgments_assignment_id_fkey"
    FOREIGN KEY ("assignment_id") REFERENCES "staffing_ops"."coordinator_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "event_coverage_requirements_event_id_role_key" ON "staffing_ops"."event_coverage_requirements"("event_id", "role");
CREATE INDEX "coordinator_availability_coordinator_id_starts_at_ends_at_idx" ON "staffing_ops"."coordinator_availability"("coordinator_id", "starts_at", "ends_at");
CREATE INDEX "event_coverage_requirements_event_id_idx" ON "staffing_ops"."event_coverage_requirements"("event_id");
CREATE INDEX "coordinator_assignment_ack_history_assignment_id_created_at_idx" ON "staffing_ops"."coordinator_assignment_acknowledgments"("assignment_id", "created_at");

ALTER TABLE "staffing_ops"."coordinator_assignments"
    ADD COLUMN "acknowledged_by" TEXT,
    ADD COLUMN "acknowledgement_reason" TEXT,
    ADD COLUMN "withdrawal_reason" TEXT,
    ADD COLUMN "withdrawn_at" TIMESTAMP(3),
    ADD COLUMN "withdrawn_by" TEXT;
