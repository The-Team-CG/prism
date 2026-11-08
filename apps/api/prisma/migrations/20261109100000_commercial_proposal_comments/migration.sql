-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Comment thread on issued proposal versions (FR-60). Any client contact of the event and PMCM can post.
CREATE TABLE "commercial"."proposal_comments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "proposal_version_id" TEXT NOT NULL,
    "author_id" TEXT,
    "author_name" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_comments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "proposal_comments_idempotency_key_key" ON "commercial"."proposal_comments"("idempotency_key");

CREATE INDEX "proposal_comments_event_id_created_at_idx" ON "commercial"."proposal_comments"("event_id", "created_at");

ALTER TABLE "commercial"."proposal_comments" ADD CONSTRAINT "proposal_comments_proposal_version_fkey" FOREIGN KEY ("proposal_version_id") REFERENCES "commercial"."proposal_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
