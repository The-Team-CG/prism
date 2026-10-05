-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "identity"."users"
  ADD COLUMN "two_factor_challenge_hash" TEXT,
  ADD COLUMN "two_factor_challenge_expires_at" TIMESTAMP(3),
  ADD COLUMN "two_factor_challenge_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "two_factor_challenge_consumed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_two_factor_challenge_hash_key"
  ON "identity"."users"("two_factor_challenge_hash");
