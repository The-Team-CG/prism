-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

-- CreateTable: one-time backup codes for authenticator sign-in. Only hashes are stored; a code works once.
CREATE TABLE "identity_access"."two_factor_backup_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_backup_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: browsers trusted for 30 days after an authenticator code. Only token hashes are stored.
CREATE TABLE "identity_access"."trusted_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "session_version" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_backup_codes_code_hash_key" ON "identity_access"."two_factor_backup_codes"("code_hash");

-- CreateIndex
CREATE INDEX "two_factor_backup_codes_user_id_idx" ON "identity_access"."two_factor_backup_codes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trusted_devices_token_hash_key" ON "identity_access"."trusted_devices"("token_hash");

-- CreateIndex
CREATE INDEX "trusted_devices_user_id_expires_at_idx" ON "identity_access"."trusted_devices"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "identity_access"."two_factor_backup_codes" ADD CONSTRAINT "two_factor_backup_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_access"."trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
