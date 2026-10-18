-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Trace post-event additional billing to the approved billing source it was issued against.
-- Rows issued before source tracing keep a NULL source; new rows are validated as approved in the command.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- AlterTable
ALTER TABLE "commercial"."additional_billings" ADD COLUMN "billing_source_id" TEXT;

-- CreateIndex
CREATE INDEX "additional_billings_billing_source_id_idx" ON "commercial"."additional_billings"("billing_source_id");

-- AddForeignKey
ALTER TABLE "commercial"."additional_billings" ADD CONSTRAINT "additional_billings_billing_source_fkey" FOREIGN KEY ("billing_source_id") REFERENCES "commercial"."billing_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
