-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-55: the language of a client's automated messages. Every existing client stays on English.
ALTER TABLE "event_lifecycle"."inquiries" ADD COLUMN "preferred_language" TEXT NOT NULL DEFAULT 'en';
