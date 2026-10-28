-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "commercial"."billing_statements"
  ADD COLUMN "supersedes_statement_id" TEXT;

ALTER TABLE "commercial"."billing_statements"
  ADD CONSTRAINT "billing_statements_supersedes_statement_event_fkey"
  FOREIGN KEY ("supersedes_statement_id", "event_id")
  REFERENCES "commercial"."billing_statements"("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "billing_statements_supersedes_statement_id_key"
  ON "commercial"."billing_statements"("supersedes_statement_id");

ALTER TABLE "commercial"."payment_milestones"
  ADD COLUMN "statement_id" TEXT,
  ADD COLUMN "superseded_at" TIMESTAMP(3),
  ADD COLUMN "credit_applied" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "commercial"."payment_milestones"
  ADD CONSTRAINT "payment_milestones_statement_event_fkey"
  FOREIGN KEY ("statement_id", "event_id")
  REFERENCES "commercial"."billing_statements"("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "payment_milestones_event_statement_idx"
  ON "commercial"."payment_milestones"("event_id", "statement_id");

ALTER TABLE "commercial"."billing_corrections"
  ADD COLUMN "replacement_statement_id" TEXT;

ALTER TABLE "commercial"."billing_corrections"
  ADD CONSTRAINT "billing_corrections_replacement_statement_event_fkey"
  FOREIGN KEY ("replacement_statement_id", "event_id")
  REFERENCES "commercial"."billing_statements"("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "billing_corrections_replacement_statement_id_key"
  ON "commercial"."billing_corrections"("replacement_statement_id");
