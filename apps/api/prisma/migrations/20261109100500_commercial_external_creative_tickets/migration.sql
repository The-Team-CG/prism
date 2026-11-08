-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-87: PMCM-managed sub-tickets for outsourced creative designers, who have no supplier entry or portal account.
CREATE TABLE "commercial"."external_creative_tickets" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "designer_name" TEXT NOT NULL,
    "designer_contact" TEXT NOT NULL DEFAULT '',
    "deliverable" TEXT NOT NULL,
    "due_date" DATE,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "progress_note" TEXT NOT NULL DEFAULT '',
    "output_document_id" TEXT,
    "output_file_name" TEXT,
    "created_by" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_creative_tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "external_creative_tickets_event_status_idx" ON "commercial"."external_creative_tickets"("event_id", "status");
