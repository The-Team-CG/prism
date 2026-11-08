-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-07: a per-event risk register by phase, with likelihood, impact and mitigation.
CREATE TABLE "event_lifecycle"."event_risks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "likelihood" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "mitigation" TEXT NOT NULL DEFAULT '',
    "owner" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "catalog_key" TEXT,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_risks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_risks_event_catalog_key" ON "event_lifecycle"."event_risks"("event_id", "catalog_key");

CREATE INDEX "event_risks_event_phase_idx" ON "event_lifecycle"."event_risks"("event_id", "phase");
