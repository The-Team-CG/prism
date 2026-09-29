-- prism-owner: platform-ops
-- prism-kind: schema
-- prism-risk: high
-- Adds nullable gateway evidence to preserve legacy AI audit rows and a
-- concurrency-safe daily token reservation ledger.

ALTER TABLE "trust_ops"."ai_audit_logs"
  ADD COLUMN "request_id" TEXT,
  ADD COLUMN "correlation_id" TEXT,
  ADD COLUMN "use_case_id" TEXT,
  ADD COLUMN "prompt_version" TEXT,
  ADD COLUMN "profile_id" TEXT,
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "requested_model" TEXT,
  ADD COLUMN "response_model" TEXT,
  ADD COLUMN "endpoint_tag" TEXT,
  ADD COLUMN "zdr_basis" TEXT,
  ADD COLUMN "input_tokens" INTEGER,
  ADD COLUMN "output_tokens" INTEGER,
  ADD COLUMN "latency_ms" INTEGER,
  ADD COLUMN "outcome" TEXT,
  ADD COLUMN "approval_state" TEXT,
  ADD COLUMN "synthetic_provenance" JSONB,
  ADD COLUMN "failure_code" TEXT,
  ADD COLUMN "budget_date" DATE,
  ADD COLUMN "reserved_tokens" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "ai_audit_logs_reserved_tokens_nonnegative"
    CHECK ("reserved_tokens" >= 0);

CREATE UNIQUE INDEX "ai_audit_logs_request_id_key"
  ON "trust_ops"."ai_audit_logs"("request_id");

CREATE TABLE "trust_ops"."ai_daily_token_usage" (
  "id" TEXT NOT NULL,
  "use_case_id" TEXT NOT NULL,
  "usage_date" DATE NOT NULL,
  "reserved_tokens" INTEGER NOT NULL DEFAULT 0,
  "consumed_tokens" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_daily_token_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_daily_token_usage_reserved_nonnegative"
    CHECK ("reserved_tokens" >= 0),
  CONSTRAINT "ai_daily_token_usage_consumed_nonnegative"
    CHECK ("consumed_tokens" >= 0),
  CONSTRAINT "ai_daily_token_usage_use_case_date_key"
    UNIQUE ("use_case_id", "usage_date")
);
