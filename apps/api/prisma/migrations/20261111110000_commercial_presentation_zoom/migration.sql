-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-61: a presentation can ask for a Zoom meeting, created when the client books a time.
ALTER TABLE "commercial"."presentation_meetings" ADD COLUMN "create_zoom_meeting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "commercial"."presentation_meetings" ADD COLUMN "zoom_meeting_id" TEXT;
