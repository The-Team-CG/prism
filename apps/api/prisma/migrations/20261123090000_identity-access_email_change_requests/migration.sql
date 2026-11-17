-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

-- CreateTable: a signed-in person's request to change their sign-in email. The link goes to the new address and
-- only its hash is stored; the change happens when the link is opened. A newer request cancels the open one.
CREATE TABLE "identity_access"."email_change_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "new_email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_change_requests_token_hash_key" ON "identity_access"."email_change_requests"("token_hash");

-- CreateIndex
CREATE INDEX "email_change_requests_user_id_created_at_idx" ON "identity_access"."email_change_requests"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "identity_access"."email_change_requests" ADD CONSTRAINT "email_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
