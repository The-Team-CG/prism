-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- A billing statement keeps the payment details it was issued with (already in payment_methods) and now also which
-- revision of PMCM's payment details those were, so a client can be told when PMCM has changed them since. Statements
-- issued before payment details existed have no revision. Touches only commercial tables.

-- AlterTable
ALTER TABLE "commercial"."billing_statements" ADD COLUMN "payment_details_revision" INTEGER;
