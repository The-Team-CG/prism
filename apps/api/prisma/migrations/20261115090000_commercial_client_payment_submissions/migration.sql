-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- A client can tell PMCM they paid. Such a receipt is marked as the client's and keeps the payment they meant it for,
-- so PMCM can check it and apply it there. Existing receipts were all recorded by PMCM. Touches only commercial tables.

-- AlterTable
ALTER TABLE "commercial"."payment_receipts" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'pmcm';
ALTER TABLE "commercial"."payment_receipts" ADD COLUMN "intended_milestone_id" TEXT;
