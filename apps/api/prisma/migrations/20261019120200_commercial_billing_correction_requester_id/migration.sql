-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Record the verified actor id that requested a billing correction so approval can enforce separation of duties by identity.
-- Rows requested before this column existed keep a NULL id; the command falls back to the requester name for them.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- AlterTable
ALTER TABLE "commercial"."billing_corrections" ADD COLUMN "requested_by_id" TEXT;

COMMIT;
