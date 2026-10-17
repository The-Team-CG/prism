-- prism-owner: platform-ops
-- prism-kind: data
-- prism-risk: medium
-- Initialize the singleton row required to serialize audit-chain appends.
INSERT INTO "platform_ops"."audit_chain_locks" ("id", "revision", "head_id", "head_hash")
SELECT 'global', 0, NULL, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "platform_ops"."audit_chain_locks" WHERE "id" = 'global'
);