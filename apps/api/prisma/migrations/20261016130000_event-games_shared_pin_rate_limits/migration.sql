-- prism-owner: event-games
-- prism-kind: schema
-- prism-risk: medium
-- Store deployment-wide event game rate limits in fixed windows with bounded expiry cleanup.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE "event_games"."rate_limit_buckets" (
    "bucket_key" TEXT NOT NULL,
    "bucket_started_at" TIMESTAMPTZ(6) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 1,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("bucket_key", "bucket_started_at"),
    CONSTRAINT "rate_limit_buckets_request_count_check" CHECK ("request_count" > 0),
    CONSTRAINT "rate_limit_buckets_expiry_check" CHECK ("expires_at" > "bucket_started_at")
);

CREATE INDEX "rate_limit_buckets_expires_at_idx"
    ON "event_games"."rate_limit_buckets"("expires_at");

COMMIT;
