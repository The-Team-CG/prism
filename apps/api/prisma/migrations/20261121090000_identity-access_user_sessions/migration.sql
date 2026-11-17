-- prism-owner: identity-access
-- prism-kind: schema
-- prism-risk: medium

-- CreateTable: one row per signed-in browser. The session token carries the row id, so a person can see where they
-- are signed in and sign out one device without ending the others. Sessions issued before this table existed carry
-- no id and stay valid until they expire.
CREATE TABLE "identity_access"."user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "session_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_sessions_user_id_expires_at_idx" ON "identity_access"."user_sessions"("user_id", "expires_at");

-- AddForeignKey
ALTER TABLE "identity_access"."user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "identity_access"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
