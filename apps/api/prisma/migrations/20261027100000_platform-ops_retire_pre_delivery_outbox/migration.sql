-- prism-owner: platform-ops
-- prism-kind: data
-- prism-risk: medium

-- Outbox email delivery starts with this release. Rows queued before it were never meant to be sent
-- late (some are weeks old), so they are retired as failed with a reason instead of being delivered now.
UPDATE "platform_ops"."notification_logs"
SET "status" = 'failed',
    "failed_at" = CURRENT_TIMESTAMP,
    "failure_reason" = 'Queued before outbox delivery was enabled; not sent',
    "lease_token" = NULL,
    "lease_expires_at" = NULL
WHERE "status" = 'queued';
