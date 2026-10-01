-- prism-owner: live-ops
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "staffing_ops"."urgent_issues"
  ALTER COLUMN "opened_by" DROP DEFAULT;
