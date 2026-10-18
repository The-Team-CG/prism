-- prism-owner: platform-ops
-- prism-kind: data
-- prism-risk: medium
-- Ensure the global audit chain lock exists on fresh and upgraded databases.
-- Existing revision/head values are preserved when the singleton is present.
INSERT INTO "platform_ops"."audit_chain_locks" ("id", "revision", "head_id", "head_hash")
VALUES ('global', 0, NULL, NULL)
ON CONFLICT ("id") DO NOTHING;
