-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium
-- Preserve existing reviewer names; new writes must provide an explicit reviewer.
ALTER TABLE "supplier_ops"."supplier_reviews"
  ALTER COLUMN "reviewed_by" DROP DEFAULT;