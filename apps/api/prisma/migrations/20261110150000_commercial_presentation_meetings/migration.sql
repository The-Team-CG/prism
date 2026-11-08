-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-61: proposal presentation meetings with offered slots, the client's choice and attendance.
CREATE TABLE "commercial"."presentation_meetings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slots" JSONB NOT NULL DEFAULT '[]',
    "chosen_start_at" TIMESTAMP(3),
    "chosen_end_at" TIMESTAMP(3),
    "meeting_link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presentation_meetings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "presentation_meetings_event_created_idx" ON "commercial"."presentation_meetings"("event_id", "created_at");
