-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- PMCM-managed file requirements: custom requirements and overrides of derived matrix items. Additive table only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateTable
CREATE TABLE "event_lifecycle"."file_requirements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "owner_role" TEXT NOT NULL,
    "visible_to_roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required" BOOLEAN NOT NULL DEFAULT true,
    "due_at" TIMESTAMP(3),
    "source_workflow" TEXT NOT NULL,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "file_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "file_requirements_event_id_key_key" ON "event_lifecycle"."file_requirements"("event_id", "key");

-- CreateIndex
CREATE INDEX "file_requirements_required_due_at_idx" ON "event_lifecycle"."file_requirements"("required", "due_at");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."file_requirements" ADD CONSTRAINT "file_requirements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
