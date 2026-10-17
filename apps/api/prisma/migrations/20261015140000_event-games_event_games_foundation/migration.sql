-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Add event-scoped game records, enforce isolation, and preserve session history.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE SCHEMA IF NOT EXISTS "event_games";

-- CreateTable
CREATE TABLE "event_games"."game_definitions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "game_kind" TEXT NOT NULL,
    "entry_mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "game_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."game_config_versions" (
    "id" TEXT NOT NULL,
    "game_definition_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "config" JSONB NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."game_sessions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "game_definition_id" TEXT NOT NULL,
    "config_version_id" TEXT NOT NULL,
    "config_snapshot" JSONB NOT NULL,
    "entry_mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "scheduled_start_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_by" TEXT NOT NULL,
    "start_idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."active_pin_reservations" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "pin_digest" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "reserved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "active_pin_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."pin_history" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "pin_digest" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pin_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."participant_credentials" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "token_digest" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),

    CONSTRAINT "participant_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."session_participation_grants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "participant_credential_id" TEXT NOT NULL,
    "entry_mode" TEXT NOT NULL,
    "granted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_by" TEXT,

    CONSTRAINT "session_participation_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."submissions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "participation_grant_id" TEXT NOT NULL,
    "round_key" TEXT NOT NULL,
    "action_kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "score_result" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."score_ledger" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "participation_grant_id" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."awards" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "recipient_key" TEXT NOT NULL,
    "participation_grant_id" TEXT,
    "team_id" TEXT,
    "award_kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" INTEGER,
    "prize_reference" TEXT,
    "assigned_by" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games"."moderation_actions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "submission_id" TEXT,
    "participation_grant_id" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "game_definitions_event_status_idx" ON "event_games"."game_definitions"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "game_definitions_event_slug_key" ON "event_games"."game_definitions"("event_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "game_definitions_event_id_id_key" ON "event_games"."game_definitions"("event_id", "id");

-- CreateIndex
CREATE INDEX "game_config_versions_event_definition_idx" ON "event_games"."game_config_versions"("event_id", "game_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_config_versions_event_definition_version_key" ON "event_games"."game_config_versions"("event_id", "game_definition_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "game_config_versions_event_definition_id_key" ON "event_games"."game_config_versions"("event_id", "game_definition_id", "id");

-- CreateIndex
CREATE INDEX "game_sessions_event_status_schedule_idx" ON "event_games"."game_sessions"("event_id", "status", "scheduled_start_at");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_event_start_idempotency_key" ON "event_games"."game_sessions"("event_id", "start_idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_event_id_id_key" ON "event_games"."game_sessions"("event_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "active_pin_reservations_session_key" ON "event_games"."active_pin_reservations"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "active_pin_reservations_digest_key" ON "event_games"."active_pin_reservations"("pin_digest");

-- CreateIndex
CREATE INDEX "active_pin_reservations_expires_at_idx" ON "event_games"."active_pin_reservations"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "active_pin_reservations_event_session_key" ON "event_games"."active_pin_reservations"("event_id", "session_id");

-- CreateIndex
CREATE INDEX "pin_history_session_created_idx" ON "event_games"."pin_history"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "pin_history_event_created_idx" ON "event_games"."pin_history"("event_id", "created_at");

-- CreateIndex
CREATE INDEX "participant_credentials_event_revoked_idx" ON "event_games"."participant_credentials"("event_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "participant_credentials_event_digest_key" ON "event_games"."participant_credentials"("event_id", "token_digest");

-- CreateIndex
CREATE UNIQUE INDEX "participant_credentials_event_id_id_key" ON "event_games"."participant_credentials"("event_id", "id");

-- CreateIndex
CREATE INDEX "session_participation_grants_event_session_revoked_idx" ON "event_games"."session_participation_grants"("event_id", "session_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_participation_grants_event_session_credential_key" ON "event_games"."session_participation_grants"("event_id", "session_id", "participant_credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_participation_grants_event_session_id_key" ON "event_games"."session_participation_grants"("event_id", "session_id", "id");

-- CreateIndex
CREATE INDEX "submissions_event_session_created_idx" ON "event_games"."submissions"("event_id", "session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_session_grant_round_action_key" ON "event_games"."submissions"("session_id", "participation_grant_id", "round_key", "action_kind");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_event_session_id_key" ON "event_games"."submissions"("event_id", "session_id", "id");

-- CreateIndex
CREATE INDEX "score_ledger_event_session_grant_created_idx" ON "event_games"."score_ledger"("event_id", "session_id", "participation_grant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "score_ledger_event_session_source_key" ON "event_games"."score_ledger"("event_id", "session_id", "source_event_id");

-- CreateIndex
CREATE INDEX "awards_event_session_created_idx" ON "event_games"."awards"("event_id", "session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "awards_event_source_recipient_key" ON "event_games"."awards"("event_id", "session_id", "source_event_id", "recipient_key");

-- CreateIndex
CREATE INDEX "moderation_actions_event_session_created_idx" ON "event_games"."moderation_actions"("event_id", "session_id", "created_at");

-- AddForeignKey
ALTER TABLE "event_games"."game_config_versions" ADD CONSTRAINT "game_config_versions_event_definition_fkey" FOREIGN KEY ("event_id", "game_definition_id") REFERENCES "event_games"."game_definitions"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."game_sessions" ADD CONSTRAINT "game_sessions_event_definition_config_fkey" FOREIGN KEY ("event_id", "game_definition_id", "config_version_id") REFERENCES "event_games"."game_config_versions"("event_id", "game_definition_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."active_pin_reservations" ADD CONSTRAINT "active_pin_reservations_event_session_fkey" FOREIGN KEY ("event_id", "session_id") REFERENCES "event_games"."game_sessions"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."pin_history" ADD CONSTRAINT "pin_history_event_session_fkey" FOREIGN KEY ("event_id", "session_id") REFERENCES "event_games"."game_sessions"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."session_participation_grants" ADD CONSTRAINT "session_participation_grants_event_session_fkey" FOREIGN KEY ("event_id", "session_id") REFERENCES "event_games"."game_sessions"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."session_participation_grants" ADD CONSTRAINT "session_participation_grants_event_credential_fkey" FOREIGN KEY ("event_id", "participant_credential_id") REFERENCES "event_games"."participant_credentials"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."submissions" ADD CONSTRAINT "submissions_event_session_grant_fkey" FOREIGN KEY ("event_id", "session_id", "participation_grant_id") REFERENCES "event_games"."session_participation_grants"("event_id", "session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."score_ledger" ADD CONSTRAINT "score_ledger_event_session_grant_fkey" FOREIGN KEY ("event_id", "session_id", "participation_grant_id") REFERENCES "event_games"."session_participation_grants"("event_id", "session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."awards" ADD CONSTRAINT "awards_event_session_grant_fkey" FOREIGN KEY ("event_id", "session_id", "participation_grant_id") REFERENCES "event_games"."session_participation_grants"("event_id", "session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."awards" ADD CONSTRAINT "awards_event_session_fkey" FOREIGN KEY ("event_id", "session_id") REFERENCES "event_games"."game_sessions"("event_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."moderation_actions" ADD CONSTRAINT "moderation_actions_event_submission_fkey" FOREIGN KEY ("event_id", "session_id", "submission_id") REFERENCES "event_games"."submissions"("event_id", "session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games"."moderation_actions" ADD CONSTRAINT "moderation_actions_event_participation_grant_fkey" FOREIGN KEY ("event_id", "session_id", "participation_grant_id") REFERENCES "event_games"."session_participation_grants"("event_id", "session_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "event_games"."awards"
  ADD CONSTRAINT "awards_recipient_shape_check"
  CHECK (
    ("recipient_type" = 'participant'
      AND "participation_grant_id" IS NOT NULL
      AND "team_id" IS NULL
      AND "recipient_key" = 'participant:' || "participation_grant_id")
    OR
    ("recipient_type" = 'team'
      AND "participation_grant_id" IS NULL
      AND "team_id" IS NOT NULL
      AND "recipient_key" = 'team:' || "team_id")
  );

ALTER TABLE "event_games"."moderation_actions"
  ADD CONSTRAINT "moderation_actions_exactly_one_target_check"
  CHECK (("submission_id" IS NOT NULL) <> ("participation_grant_id" IS NOT NULL));
COMMIT;
