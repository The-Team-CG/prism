-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: low

-- FR-25: per-account notification channels. An account links Viber with a one-time code opened in the P.R.I.S.M bot;
-- email stays on for everyone. Only the code's SHA-256 is stored.
CREATE TABLE "platform_ops"."notification_channel_preferences" (
    "email" TEXT NOT NULL,
    "viber_user_id" TEXT,
    "viber_enabled" BOOLEAN NOT NULL DEFAULT false,
    "viber_linked_at" TIMESTAMP(3),
    "link_code_hash" TEXT,
    "link_code_expires_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channel_preferences_pkey" PRIMARY KEY ("email")
);

CREATE UNIQUE INDEX "notification_channel_preferences_viber_user_id_key" ON "platform_ops"."notification_channel_preferences"("viber_user_id");
CREATE UNIQUE INDEX "notification_channel_preferences_link_code_hash_key" ON "platform_ops"."notification_channel_preferences"("link_code_hash");
