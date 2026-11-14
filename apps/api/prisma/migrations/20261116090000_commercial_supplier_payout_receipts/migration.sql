-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: low

-- A supplier can confirm a payout reached them and attach their official receipt for it. Both are optional and set
-- only by the supplier on a release; existing payouts stay unconfirmed. Touches only commercial tables.

-- AlterTable
ALTER TABLE "commercial"."supplier_payout_records" ADD COLUMN "received_at" TIMESTAMP(3);
ALTER TABLE "commercial"."supplier_payout_records" ADD COLUMN "received_by" TEXT;
ALTER TABLE "commercial"."supplier_payout_records" ADD COLUMN "official_receipt_object_id" TEXT;
ALTER TABLE "commercial"."supplier_payout_records" ADD COLUMN "official_receipt_file_name" TEXT;
