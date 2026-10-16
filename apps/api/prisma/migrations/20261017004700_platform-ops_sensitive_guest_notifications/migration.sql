-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE "platform_ops"."notification_logs"
    ADD COLUMN "guest_pass_id" TEXT,
    ADD COLUMN "sensitive_payload" TEXT;

COMMIT;
