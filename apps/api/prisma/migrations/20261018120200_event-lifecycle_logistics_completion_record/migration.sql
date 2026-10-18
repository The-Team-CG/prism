-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium
-- Authoritative PMCM-recorded logistics completion (one record per event). Additive table only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateTable
CREATE TABLE "event_lifecycle"."logistics_completions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "asset_returns_verified" BOOLEAN NOT NULL,
    "completion_summary" TEXT NOT NULL,
    "private_notes" TEXT NOT NULL DEFAULT '',
    "correction_reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_completions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "logistics_completions_event_id_key" ON "event_lifecycle"."logistics_completions"("event_id");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."logistics_completions" ADD CONSTRAINT "logistics_completions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_lifecycle"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
