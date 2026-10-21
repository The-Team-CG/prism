-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium
-- Owner-scoped baseline for the identity_access schema.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity_access";

-- CreateTable
CREATE TABLE "identity_access"."users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "lockout_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "permanent_lockout" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "two_factor_secret" TEXT,
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "two_factor_challenge_hash" TEXT,
    "two_factor_challenge_expires_at" TIMESTAMP(3),
    "two_factor_challenge_attempts" INTEGER NOT NULL DEFAULT 0,
    "two_factor_challenge_consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_access"."password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_access"."password_reset_rate_limits" (
    "id" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "client_ip" TEXT NOT NULL,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_access"."approval_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    "marketing_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "identity_access"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_two_factor_challenge_hash_key" ON "identity_access"."users"("two_factor_challenge_hash");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "identity_access"."password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_expires_at_idx" ON "identity_access"."password_reset_tokens"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "identity_access"."password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "password_reset_rate_limits_window_started_at_idx" ON "identity_access"."password_reset_rate_limits"("window_started_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_rate_limits_email_ip_key" ON "identity_access"."password_reset_rate_limits"("normalized_email", "client_ip");

-- CreateIndex
CREATE INDEX "approval_requests_status_requested_at_idx" ON "identity_access"."approval_requests"("status", "requested_at");

-- CreateIndex
CREATE INDEX "approval_requests_user_id_idx" ON "identity_access"."approval_requests"("user_id");

-- AddForeignKey
ALTER TABLE "identity_access"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_access"."approval_requests" ADD CONSTRAINT "approval_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
