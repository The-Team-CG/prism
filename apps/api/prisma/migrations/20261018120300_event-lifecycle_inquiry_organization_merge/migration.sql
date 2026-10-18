-- AlterTable
ALTER TABLE "event_lifecycle"."inquiries" ADD COLUMN "organization_key" TEXT;

-- Backfill: letters and digits of the company name, lowercased (matches inquiryOrganizationKey in the API).
UPDATE "event_lifecycle"."inquiries"
SET "organization_key" = NULLIF(lower(regexp_replace("company_name", '[^[:alnum:]]+', '', 'g')), '')
WHERE "company_name" <> '';

-- CreateTable
CREATE TABLE "event_lifecycle"."inquiry_merges" (
    "id" TEXT NOT NULL,
    "primary_inquiry_id" TEXT NOT NULL,
    "merged_inquiry_id" TEXT NOT NULL,
    "organization_key" TEXT,
    "match_basis" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_merges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_merges_merged_inquiry_id_key" ON "event_lifecycle"."inquiry_merges"("merged_inquiry_id");

-- CreateIndex
CREATE INDEX "inquiry_merges_primary_inquiry_id_created_at_idx" ON "event_lifecycle"."inquiry_merges"("primary_inquiry_id", "created_at");

-- CreateIndex
CREATE INDEX "inquiries_organization_key_created_at_idx" ON "event_lifecycle"."inquiries"("organization_key", "created_at");

-- AddForeignKey
ALTER TABLE "event_lifecycle"."inquiry_merges" ADD CONSTRAINT "inquiry_merges_primary_inquiry_id_fkey" FOREIGN KEY ("primary_inquiry_id") REFERENCES "event_lifecycle"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_lifecycle"."inquiry_merges" ADD CONSTRAINT "inquiry_merges_merged_inquiry_id_fkey" FOREIGN KEY ("merged_inquiry_id") REFERENCES "event_lifecycle"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
