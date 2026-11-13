-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

-- Stored files can carry the last day they are valid (permits, insurance, registrations), so a reused file is not
-- sent after it expires and the requirement reminder sweep can warn before it does. Adds one nullable column; existing
-- rows keep no expiry and nothing is rewritten.
ALTER TABLE "platform_ops"."stored_objects" ADD COLUMN "expires_at" TIMESTAMP(3);
