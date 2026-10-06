-- prism-owner: commercial
-- prism-kind: mixed
-- prism-risk: medium

-- Quote-request links carry a bearer token. Give each token an expiry and a revocation time so a link stops
-- working when it ages out or when the supplier assignment is withdrawn.
ALTER TABLE "commercial"."quote_requests"
  ADD COLUMN "access_token_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "access_token_revoked_at" TIMESTAMPTZ(6);

-- Rotation window: every existing link keeps working for 90 days after this migration, so suppliers with an
-- open request are not locked out, and then expires. Withdrawn assignments are revoked immediately.
UPDATE "commercial"."quote_requests"
SET "access_token_expires_at" = now() + interval '90 days',
    "access_token_revoked_at" = CASE WHEN "assignment_status" = 'withdrawn' THEN now() ELSE NULL END;
