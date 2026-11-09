-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: medium

-- FR-59 and New-P3: PMCM connects one Canva account (Canva Connect OAuth with PKCE). Tokens and the PKCE verifier
-- are stored sealed with AES-256-GCM; only a hash of the OAuth state is kept.
CREATE TABLE "platform_ops"."canva_connections" (
    "id" TEXT NOT NULL,
    "access_token_sealed" TEXT NOT NULL,
    "refresh_token_sealed" TEXT NOT NULL,
    "access_expires_at" TIMESTAMP(3) NOT NULL,
    "connected_by" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canva_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_ops"."canva_oauth_states" (
    "state_hash" TEXT NOT NULL,
    "code_verifier_sealed" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "canva_oauth_states_pkey" PRIMARY KEY ("state_hash")
);

CREATE INDEX "canva_oauth_states_expires_at_idx" ON "platform_ops"."canva_oauth_states"("expires_at");
