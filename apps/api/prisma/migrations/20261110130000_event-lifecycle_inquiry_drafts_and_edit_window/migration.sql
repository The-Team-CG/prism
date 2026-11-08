-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-50: public inquiry drafts, saved only after privacy consent and purged after 30 days.
CREATE TABLE "event_lifecycle"."inquiry_drafts" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "reminded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_drafts_updated_idx" ON "event_lifecycle"."inquiry_drafts"("updated_at");

-- FR-50: the submitter's 24-hour edit link, stored as a hash.
ALTER TABLE "event_lifecycle"."inquiries" ADD COLUMN "edit_token_hash" TEXT;
CREATE UNIQUE INDEX "inquiries_edit_token_hash_key" ON "event_lifecycle"."inquiries"("edit_token_hash");
