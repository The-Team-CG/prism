-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

-- Audit evidence is only valid if every new link in the hash chain is a lower-case SHA-256 digest. These constraints
-- are added NOT VALID on purpose and are not validated here: they apply to every new or updated row, while historical
-- rows (including any pre-repair rows with an empty or non-canonical hash) are left untouched for the guarded
-- audit-chain repair to handle. Nothing is rewritten or deleted.
ALTER TABLE "platform_ops"."audit_logs"
  ADD CONSTRAINT "audit_logs_immutable_hash_chk" CHECK ("immutable_hash" ~ '^[0-9a-f]{64}$') NOT VALID,
  ADD CONSTRAINT "audit_logs_previous_hash_chk" CHECK ("previous_hash" IS NULL OR "previous_hash" ~ '^[0-9a-f]{64}$') NOT VALID;

-- The chain head can only move forward and always names a valid digest.
ALTER TABLE "platform_ops"."audit_chain_locks"
  ADD CONSTRAINT "audit_chain_locks_head_chk"
  CHECK ("revision" >= 0 AND ("head_hash" IS NULL OR "head_hash" ~ '^[0-9a-f]{64}$')) NOT VALID;
