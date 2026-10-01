-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium
-- New privacy and AI approval writes supply their actual verified requester.
ALTER TABLE "event_core"."privacy_requests"
  ALTER COLUMN "created_by" DROP DEFAULT;

ALTER TABLE "trust_ops"."ai_approval_records"
  ALTER COLUMN "requested_by" DROP DEFAULT;
