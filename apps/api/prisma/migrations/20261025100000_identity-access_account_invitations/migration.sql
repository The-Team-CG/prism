-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

-- AlterTable: a null password marks an account that was created but not yet activated.
ALTER TABLE "identity_access"."users" ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "identity_access"."account_invitations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_invitations_token_hash_key" ON "identity_access"."account_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "account_invitations_user_id_expires_at_idx" ON "identity_access"."account_invitations"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "account_invitations_expires_at_idx" ON "identity_access"."account_invitations"("expires_at");

-- AddForeignKey
ALTER TABLE "identity_access"."account_invitations" ADD CONSTRAINT "account_invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
