-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-53: pre-conforme discussion notes, scope flags and follow-ups on the inquiry.
CREATE TABLE "event_lifecycle"."inquiry_context_notes" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "follow_up_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_context_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_context_notes_inquiry_created_idx" ON "event_lifecycle"."inquiry_context_notes"("inquiry_id", "created_at");

-- FR-70: accreditation documents with their own SLA; never a planning gate.
CREATE TABLE "event_lifecycle"."accreditation_requirements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "due_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accreditation_requirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accreditation_requirements_event_status_idx" ON "event_lifecycle"."accreditation_requirements"("event_id", "status");
