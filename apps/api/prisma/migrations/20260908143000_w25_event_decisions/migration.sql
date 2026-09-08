CREATE TABLE "event_core"."event_decisions" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "actor_role" TEXT NOT NULL,
  "actor_name" TEXT NOT NULL,
  "actor_email" TEXT,
  "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "prior_state" JSONB NOT NULL,
  "financial_impact" JSONB NOT NULL DEFAULT '{}',
  "assignment_impact" JSONB NOT NULL DEFAULT '{}',
  "supplier_impact" TEXT NOT NULL,
  "notification_intent" TEXT NOT NULL DEFAULT 'queued',
  "notification_reason" TEXT,
  "storage_intent" TEXT NOT NULL DEFAULT 'pending',
  "idempotency_key" TEXT,
  CONSTRAINT "event_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "event_decisions_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "event_decisions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "event_decisions_event_id_decided_at_idx" ON "event_core"."event_decisions"("event_id", "decided_at");
