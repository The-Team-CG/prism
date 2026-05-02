-- Phase 4 compliance rules, billing source, close gates, and event insights.

ALTER TABLE "ops_events"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archive_override_reason" TEXT,
  ADD COLUMN "archive_override_by" TEXT,
  ADD COLUMN "archive_checklist" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "ops_compliance_rules" (
  "id" TEXT NOT NULL,
  "event_id" TEXT,
  "event_type" TEXT NOT NULL DEFAULT '',
  "phase" TEXT NOT NULL DEFAULT 'planning',
  "severity" TEXT NOT NULL DEFAULT 'must_fix',
  "layer" TEXT NOT NULL DEFAULT 'Must-Fix',
  "condition_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_compliance_rules_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ops_compliance_checks"
  ADD COLUMN "rule_id" TEXT,
  ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'must_fix',
  ADD COLUMN "phase" TEXT NOT NULL DEFAULT 'planning',
  ADD COLUMN "condition_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "resolved_at" TIMESTAMP(3),
  ADD COLUMN "resolved_by" TEXT,
  ADD COLUMN "override_reason" TEXT,
  ADD COLUMN "override_at" TIMESTAMP(3),
  ADD COLUMN "override_by" TEXT;

CREATE TABLE "ops_billing_sources" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL DEFAULT 'ce_proposal',
  "source_label" TEXT NOT NULL,
  "source_document_id" TEXT,
  "line_items" JSONB NOT NULL DEFAULT '[]',
  "payment_schedule" JSONB NOT NULL DEFAULT '[]',
  "payment_methods" JSONB NOT NULL DEFAULT '[]',
  "total_amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "approved_at" TIMESTAMP(3),
  "approved_by" TEXT,
  "approval_notes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_billing_sources_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ops_billing_statements"
  ADD COLUMN "source_id" TEXT;

CREATE TABLE "ops_event_insights" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "highlights" JSONB NOT NULL DEFAULT '[]',
  "risks" JSONB NOT NULL DEFAULT '[]',
  "supplier_notes" JSONB NOT NULL DEFAULT '[]',
  "financial_summary" JSONB NOT NULL DEFAULT '{}',
  "document_summary" JSONB NOT NULL DEFAULT '{}',
  "feedback_summary" JSONB NOT NULL DEFAULT '{}',
  "private_notes" TEXT NOT NULL DEFAULT '',
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_event_insights_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ops_event_insights_event_id_key" ON "ops_event_insights"("event_id");
CREATE INDEX "ops_compliance_rules_active_phase_idx" ON "ops_compliance_rules"("active", "phase");
CREATE INDEX "ops_compliance_rules_event_type_phase_idx" ON "ops_compliance_rules"("event_type", "phase");
CREATE INDEX "ops_compliance_rules_event_id_idx" ON "ops_compliance_rules"("event_id");
CREATE INDEX "ops_compliance_checks_rule_id_idx" ON "ops_compliance_checks"("rule_id");
CREATE INDEX "ops_compliance_checks_phase_severity_idx" ON "ops_compliance_checks"("phase", "severity");
CREATE INDEX "ops_billing_sources_event_id_status_idx" ON "ops_billing_sources"("event_id", "status");
CREATE INDEX "ops_billing_statements_source_id_idx" ON "ops_billing_statements"("source_id");
CREATE INDEX "ops_event_insights_generated_at_idx" ON "ops_event_insights"("generated_at");

ALTER TABLE "ops_compliance_rules"
  ADD CONSTRAINT "ops_compliance_rules_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_compliance_checks"
  ADD CONSTRAINT "ops_compliance_checks_rule_id_fkey"
  FOREIGN KEY ("rule_id") REFERENCES "ops_compliance_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_billing_sources"
  ADD CONSTRAINT "ops_billing_sources_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_billing_statements"
  ADD CONSTRAINT "ops_billing_statements_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "ops_billing_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_event_insights"
  ADD CONSTRAINT "ops_event_insights_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
