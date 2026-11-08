-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

-- Records who filed each privacy request. Existing rows, all PMCM-logged, take the 'pmcm_logged' default;
-- no request rows are changed. A constant default on ADD COLUMN is a metadata-only change on PostgreSQL 11+.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- AlterTable
ALTER TABLE "platform_ops"."privacy_requests" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'pmcm_logged';

COMMIT;
