ALTER TABLE "compliance_ops"."compliance_rules"
  ADD COLUMN "definition_status" TEXT NOT NULL DEFAULT 'PROVISIONAL',
  ADD COLUMN "remediation" TEXT NOT NULL DEFAULT '';

ALTER TABLE "compliance_ops"."compliance_checks"
  ADD COLUMN "run_id" TEXT,
  ADD COLUMN "evaluation_status" TEXT NOT NULL DEFAULT 'not_satisfied',
  ADD COLUMN "evidence" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "definition_status" TEXT NOT NULL DEFAULT 'PROVISIONAL',
  ADD COLUMN "remediation" TEXT NOT NULL DEFAULT '';

CREATE TABLE "compliance_ops"."compliance_runs" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "started_at" TIMESTAMP(3) NOT NULL,
  "completed_at" TIMESTAMP(3),
  "rule_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance_ops"."compliance_risks" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "rule_id" TEXT,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'medium',
  "owner" TEXT NOT NULL DEFAULT '',
  "mitigation" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'open',
  "source" TEXT NOT NULL DEFAULT 'rule',
  "closed_at" TIMESTAMP(3),
  "closed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_risks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "compliance_ops"."compliance_risk_history" (
  "id" TEXT NOT NULL,
  "risk_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "phase" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "mitigation" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "reason" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "compliance_risk_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compliance_checks_run_id_idx" ON "compliance_ops"."compliance_checks"("run_id");
CREATE INDEX "compliance_runs_event_id_created_at_idx" ON "compliance_ops"."compliance_runs"("event_id", "created_at");
CREATE INDEX "compliance_runs_event_id_phase_status_idx" ON "compliance_ops"."compliance_runs"("event_id", "phase", "status");
CREATE INDEX "compliance_risks_event_id_phase_status_idx" ON "compliance_ops"."compliance_risks"("event_id", "phase", "status");
CREATE INDEX "compliance_risks_rule_id_idx" ON "compliance_ops"."compliance_risks"("rule_id");
CREATE INDEX "compliance_risk_history_risk_id_created_at_idx" ON "compliance_ops"."compliance_risk_history"("risk_id", "created_at");

ALTER TABLE "compliance_ops"."compliance_checks"
  ADD CONSTRAINT "compliance_checks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "compliance_ops"."compliance_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compliance_ops"."compliance_runs"
  ADD CONSTRAINT "compliance_runs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_ops"."compliance_risks"
  ADD CONSTRAINT "compliance_risks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "compliance_risks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "compliance_ops"."compliance_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "compliance_ops"."compliance_risk_history"
  ADD CONSTRAINT "compliance_risk_history_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "compliance_ops"."compliance_risks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
