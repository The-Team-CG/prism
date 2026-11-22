-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium

-- CreateIndex: the latest-moderation lookup per submission (score ledger, leaderboard, moderation queue) filters on
-- event, session and submission, then reads the newest row. The session index alone scans every moderation row of the
-- session for each lookup. Plain CREATE INDEX (not CONCURRENTLY) because Prisma runs migrations in a transaction; it
-- briefly blocks writes to moderation_actions while it builds.
CREATE INDEX "moderation_actions_latest_per_submission_idx" ON "event_games"."moderation_actions"("event_id", "session_id", "submission_id", "created_at" DESC, "id" DESC);
