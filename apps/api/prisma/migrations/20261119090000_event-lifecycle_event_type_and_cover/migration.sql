-- prism-owner: event-lifecycle
-- prism-kind: mixed
-- prism-risk: medium

-- Events carry their inquiry's event type, which picks each event's generated cover on the events cards, and an
-- optional cover image PMCM chose from the event's files. Existing events copy the type from their inquiry and have no
-- cover image. Touches only event_lifecycle tables.

-- AlterTable
ALTER TABLE "event_lifecycle"."events" ADD COLUMN "event_type" TEXT NOT NULL DEFAULT '',
ADD COLUMN "cover_object_id" TEXT;

UPDATE "event_lifecycle"."events"
SET "event_type" = "event_lifecycle"."inquiries"."event_type"
FROM "event_lifecycle"."inquiries"
WHERE "event_lifecycle"."inquiries"."id" = "event_lifecycle"."events"."inquiry_id";
