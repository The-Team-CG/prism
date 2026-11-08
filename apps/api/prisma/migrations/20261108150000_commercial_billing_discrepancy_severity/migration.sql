-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Billing corrections and disputes carry a discrepancy severity. Existing rows predate the
-- distinction and are all amount discrepancies; the default is dropped so new rows must state it.
ALTER TABLE "commercial"."billing_corrections" ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'amount_discrepancy';
ALTER TABLE "commercial"."billing_corrections" ALTER COLUMN "severity" DROP DEFAULT;

ALTER TABLE "commercial"."billing_disputes" ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'amount_discrepancy';
ALTER TABLE "commercial"."billing_disputes" ALTER COLUMN "severity" DROP DEFAULT;
