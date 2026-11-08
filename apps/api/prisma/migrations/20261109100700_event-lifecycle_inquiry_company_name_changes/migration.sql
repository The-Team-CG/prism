-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

-- FR-44: a change log for PMCM edits to a client's company name.
CREATE TABLE "event_lifecycle"."inquiry_company_name_changes" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "from_name" TEXT NOT NULL,
    "to_name" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_company_name_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_company_name_changes_inquiry_changed_idx" ON "event_lifecycle"."inquiry_company_name_changes"("inquiry_id", "changed_at");
