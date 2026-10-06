-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium
-- Owner-scoped baseline for the operations schema.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "operations";

-- CreateTable
CREATE TABLE "operations"."coordinators" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "photo_url" TEXT,
    "role_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "skills_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."coordinator_availability" (
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

-- CreateTable
CREATE TABLE "operations"."event_coverage_requirements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "required" INTEGER NOT NULL,
    "required_skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_coverage_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."coordinator_assignments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "coordinator_id" TEXT,
    "coordinator_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_acknowledgement',
    "attendance_status" TEXT NOT NULL DEFAULT 'pending',
    "attendance_marked_at" TIMESTAMP(3),
    "attendance_notes" TEXT NOT NULL DEFAULT '',
    "replaced_by_assignment_id" TEXT,
    "replacement_reason" TEXT NOT NULL DEFAULT '',
    "replaced_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "double_booking_warning" BOOLEAN NOT NULL DEFAULT false,
    "event_date" TIMESTAMP(3),
    "conflict_event_id" TEXT,
    "conflict_event_name" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "acknowledgement_reason" TEXT,
    "withdrawal_reason" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."coordinator_assignment_acknowledgments" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actor" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_assignment_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."coordinator_reliability_notes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "coordinator_id" TEXT,
    "assignment_id" TEXT,
    "note" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coordinator_reliability_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."check_ins" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "roster_entry_id" TEXT,
    "guest_name" TEXT NOT NULL,
    "check_in_mode" TEXT NOT NULL DEFAULT 'name_search',
    "status" TEXT NOT NULL DEFAULT 'checked_in',
    "walk_in" BOOLEAN NOT NULL DEFAULT false,
    "verification_status" TEXT NOT NULL DEFAULT 'verified',
    "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."guest_roster_entries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_key" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "table" TEXT NOT NULL DEFAULT '',
    "eligibility" TEXT NOT NULL DEFAULT 'eligible',
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "import_batch_id" TEXT,
    "checked_in_at" TIMESTAMP(3),
    "withdrawn_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_roster_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."guest_roster_imports" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "imported_by_id" TEXT,
    "imported_by" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "row_count" INTEGER NOT NULL,
    "raw_file_upload_blocked" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "guest_roster_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."feedback" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "photo_file_name" TEXT,
    "video_file_name" TEXT,
    "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "moderation_status" TEXT NOT NULL DEFAULT 'pending_review',
    "moderation_reason" TEXT,
    "moderated_by_id" TEXT,
    "moderated_by" TEXT,
    "moderated_at" TIMESTAMP(3),
    "privacy_consent_withdrawn_at" TIMESTAMP(3),
    "marketing_consent_withdrawn_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."feedback_media" (
    "id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_storage',
    "blocker" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations"."registration_platforms" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "platform_type" TEXT NOT NULL DEFAULT 'none',
    "supplier_id" TEXT,
    "expected_pax_min" INTEGER NOT NULL DEFAULT 0,
    "expected_pax_max" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "setup_confirmed_at" TIMESTAMPTZ(6),
    "setup_notes" TEXT NOT NULL DEFAULT '',
    "headcount_source" TEXT NOT NULL DEFAULT '',
    "imported_headcount" INTEGER NOT NULL DEFAULT 0,
    "imported_at" TIMESTAMPTZ(6),
    "imported_file_name" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coordinators_user_id_key" ON "operations"."coordinators"("user_id");

-- CreateIndex
CREATE INDEX "coordinators_active_name_idx" ON "operations"."coordinators"("active", "name");

-- CreateIndex
CREATE INDEX "coordinators_role_tags_gin_idx" ON "operations"."coordinators" USING GIN ("role_tags");

-- CreateIndex
CREATE INDEX "coordinators_skills_tags_gin_idx" ON "operations"."coordinators" USING GIN ("skills_tags");

-- CreateIndex
CREATE INDEX "coordinator_availability_coordinator_id_starts_at_ends_at_idx" ON "operations"."coordinator_availability"("coordinator_id", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "event_coverage_requirements_event_id_idx" ON "operations"."event_coverage_requirements"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_coverage_requirements_event_id_role_key" ON "operations"."event_coverage_requirements"("event_id", "role");

-- CreateIndex
CREATE INDEX "coordinator_assignments_event_id_status_idx" ON "operations"."coordinator_assignments"("event_id", "status");

-- CreateIndex
CREATE INDEX "coordinator_assignments_coordinator_id_event_date_idx" ON "operations"."coordinator_assignments"("coordinator_id", "event_date");

-- CreateIndex
CREATE INDEX "coordinator_assignments_event_id_attendance_status_idx" ON "operations"."coordinator_assignments"("event_id", "attendance_status");

-- CreateIndex
CREATE INDEX "coordinator_assignment_ack_history_assignment_id_created_at_idx" ON "operations"."coordinator_assignment_acknowledgments"("assignment_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_reliability_notes_event_id_created_at_idx" ON "operations"."coordinator_reliability_notes"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_reliability_notes_coordinator_id_created_at_idx" ON "operations"."coordinator_reliability_notes"("coordinator_id", "created_at");

-- CreateIndex
CREATE INDEX "coordinator_reliability_notes_assignment_id_idx" ON "operations"."coordinator_reliability_notes"("assignment_id");

-- CreateIndex
CREATE INDEX "check_ins_event_id_checked_in_at_idx" ON "operations"."check_ins"("event_id", "checked_in_at");

-- CreateIndex
CREATE INDEX "check_ins_event_id_guest_name_idx" ON "operations"."check_ins"("event_id", "guest_name");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_event_id_roster_entry_id_key" ON "operations"."check_ins"("event_id", "roster_entry_id");

-- CreateIndex
CREATE INDEX "guest_roster_event_name_idx" ON "operations"."guest_roster_entries"("event_id", "normalized_name");

-- CreateIndex
CREATE INDEX "guest_roster_event_eligibility_idx" ON "operations"."guest_roster_entries"("event_id", "eligibility");

-- CreateIndex
CREATE UNIQUE INDEX "guest_roster_entries_id_event_id_key" ON "operations"."guest_roster_entries"("id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_roster_event_source_key" ON "operations"."guest_roster_entries"("event_id", "source_key");

-- CreateIndex
CREATE INDEX "guest_roster_imports_event_imported_at_idx" ON "operations"."guest_roster_imports"("event_id", "imported_at");

-- CreateIndex
CREATE UNIQUE INDEX "guest_roster_imports_id_event_id_key" ON "operations"."guest_roster_imports"("id", "event_id");

-- CreateIndex
CREATE INDEX "feedback_event_id_moderation_status_idx" ON "operations"."feedback"("event_id", "moderation_status");

-- CreateIndex
CREATE INDEX "feedback_media_feedback_id_idx" ON "operations"."feedback_media"("feedback_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_platforms_event_id_key" ON "operations"."registration_platforms"("event_id");

-- AddForeignKey
ALTER TABLE "operations"."coordinator_availability" ADD CONSTRAINT "coordinator_availability_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "operations"."coordinators"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."coordinator_assignments" ADD CONSTRAINT "coordinator_assignments_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "operations"."coordinators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."coordinator_assignment_acknowledgments" ADD CONSTRAINT "coordinator_assignment_acknowledgments_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "operations"."coordinator_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."coordinator_reliability_notes" ADD CONSTRAINT "coordinator_reliability_notes_coordinator_id_fkey" FOREIGN KEY ("coordinator_id") REFERENCES "operations"."coordinators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."coordinator_reliability_notes" ADD CONSTRAINT "coordinator_reliability_notes_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "operations"."coordinator_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."check_ins" ADD CONSTRAINT "check_ins_roster_entry_event_fkey" FOREIGN KEY ("roster_entry_id", "event_id") REFERENCES "operations"."guest_roster_entries"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."guest_roster_entries" ADD CONSTRAINT "guest_roster_entries_import_event_fkey" FOREIGN KEY ("import_batch_id", "event_id") REFERENCES "operations"."guest_roster_imports"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations"."feedback_media" ADD CONSTRAINT "feedback_media_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "operations"."feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
