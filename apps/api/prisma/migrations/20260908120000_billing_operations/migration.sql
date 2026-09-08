ALTER TABLE "finance_ops"."billing_sources"
  ADD COLUMN IF NOT EXISTS "payment_terms_policy_state" TEXT NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS "payment_terms_override_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "payment_terms_approved_by" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "payload_hash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "billing_sources_idempotency_key_key"
  ON "finance_ops"."billing_sources"("idempotency_key");

ALTER TABLE "finance_ops"."billing_statements"
  ADD COLUMN IF NOT EXISTS "storage_object_id" TEXT,
  ADD COLUMN IF NOT EXISTS "storage_state" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "payload_hash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "billing_statements_idempotency_key_key"
  ON "finance_ops"."billing_statements"("idempotency_key");

ALTER TABLE "finance_ops"."payment_records"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT,
  ADD COLUMN IF NOT EXISTS "payload_hash" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "payment_records_idempotency_key_key"
  ON "finance_ops"."payment_records"("idempotency_key");

CREATE TABLE IF NOT EXISTS "finance_ops"."billing_corrections" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "statement_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "corrected_total_amount" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requested_by" TEXT NOT NULL,
  "resolved_by" TEXT,
  "resolution_notes" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "billing_corrections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_corrections_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_corrections_idempotency_key_key" ON "finance_ops"."billing_corrections"("idempotency_key");
CREATE INDEX IF NOT EXISTS "billing_corrections_event_id_status_idx" ON "finance_ops"."billing_corrections"("event_id", "status");
CREATE INDEX IF NOT EXISTS "billing_corrections_statement_id_created_at_idx" ON "finance_ops"."billing_corrections"("statement_id", "created_at");

CREATE TABLE IF NOT EXISTS "finance_ops"."billing_disputes" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "statement_id" TEXT NOT NULL,
  "milestone_id" TEXT,
  "amount" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "raised_by" TEXT NOT NULL,
  "resolved_by" TEXT,
  "resolution_notes" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "billing_disputes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_disputes_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "billing_disputes_idempotency_key_key" ON "finance_ops"."billing_disputes"("idempotency_key");
CREATE INDEX IF NOT EXISTS "billing_disputes_event_id_status_idx" ON "finance_ops"."billing_disputes"("event_id", "status");
CREATE INDEX IF NOT EXISTS "billing_disputes_statement_id_created_at_idx" ON "finance_ops"."billing_disputes"("statement_id", "created_at");

CREATE TABLE IF NOT EXISTS "finance_ops"."additional_billings" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "urgent_issue_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_approval',
  "created_by" TEXT NOT NULL,
  "waiver_reason" TEXT,
  "waived_by" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "waived_at" TIMESTAMP(3),
  CONSTRAINT "additional_billings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "additional_billings_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "additional_billings_idempotency_key_key" ON "finance_ops"."additional_billings"("idempotency_key");
CREATE INDEX IF NOT EXISTS "additional_billings_event_id_status_idx" ON "finance_ops"."additional_billings"("event_id", "status");
CREATE INDEX IF NOT EXISTS "additional_billings_urgent_issue_id_idx" ON "finance_ops"."additional_billings"("urgent_issue_id");
