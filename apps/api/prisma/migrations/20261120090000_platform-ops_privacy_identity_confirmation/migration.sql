-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

-- A self-service privacy request records when and how the requester confirmed who they are (their account
-- password), so PMCM can see identity was checked before acting. Existing requests keep nulls. Touches only
-- platform_ops tables.

-- AlterTable
ALTER TABLE "platform_ops"."privacy_requests" ADD COLUMN "identity_confirmed_at" TIMESTAMP(3),
ADD COLUMN "identity_method" TEXT;
