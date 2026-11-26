-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: low

-- CreateTable: six-digit sign-in codes emailed to clients and suppliers instead of a password. Only the code's hash is
-- stored; a code is single use, a newer code consumes the open ones, and too many wrong tries end it.
CREATE TABLE "identity_access"."email_sign_in_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_sign_in_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_sign_in_codes_user_id_created_at_idx" ON "identity_access"."email_sign_in_codes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "email_sign_in_codes_expires_at_idx" ON "identity_access"."email_sign_in_codes"("expires_at");

-- AddForeignKey
ALTER TABLE "identity_access"."email_sign_in_codes" ADD CONSTRAINT "email_sign_in_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
