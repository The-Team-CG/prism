CREATE SCHEMA IF NOT EXISTS "finance_ops";

ALTER TABLE "event_core"."briefings" ADD COLUMN "confirmed_date" TIMESTAMP(3), ADD COLUMN "confirmed_start_time" TEXT, ADD COLUMN "confirmed_end_time" TEXT, ADD COLUMN "program" JSONB NOT NULL DEFAULT '[]', ADD COLUMN "mood_and_styling" TEXT NOT NULL DEFAULT '', ADD COLUMN "styling_budget" INTEGER;

CREATE TABLE "finance_ops"."cost_estimates" (
  "id" TEXT NOT NULL, "event_id" TEXT NOT NULL, "budget_amount" INTEGER NOT NULL,
  "total_amount" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT NOT NULL DEFAULT '', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cost_estimates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cost_estimates_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "cost_estimates_event_id_created_at_idx" ON "finance_ops"."cost_estimates"("event_id", "created_at");
CREATE TABLE "finance_ops"."cost_estimate_lines" (
  "id" TEXT NOT NULL, "estimate_id" TEXT NOT NULL, "category" TEXT NOT NULL, "description" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL, "unit_amount" INTEGER NOT NULL, "total_amount" INTEGER NOT NULL, "source_line_id" TEXT,
  CONSTRAINT "cost_estimate_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cost_estimate_lines_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "finance_ops"."cost_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "cost_estimate_lines_estimate_id_category_idx" ON "finance_ops"."cost_estimate_lines"("estimate_id", "category");
CREATE TABLE "finance_ops"."proposal_versions" (
  "id" TEXT NOT NULL, "event_id" TEXT NOT NULL, "cost_estimate_id" TEXT NOT NULL, "version_number" INTEGER NOT NULL,
  "title" TEXT NOT NULL, "summary" TEXT NOT NULL DEFAULT '', "total_amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft', "revision_note" TEXT NOT NULL DEFAULT '', "issued_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "proposal_versions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "proposal_versions_cost_estimate_id_fkey" FOREIGN KEY ("cost_estimate_id") REFERENCES "finance_ops"."cost_estimates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "proposal_versions_event_version_key" ON "finance_ops"."proposal_versions"("event_id", "version_number");
CREATE INDEX "proposal_versions_event_id_status_idx" ON "finance_ops"."proposal_versions"("event_id", "status");
