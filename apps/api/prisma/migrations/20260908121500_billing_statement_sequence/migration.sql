CREATE TABLE IF NOT EXISTS "finance_ops"."billing_statement_sequences" (
  "year" INTEGER NOT NULL,
  "next_number" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "billing_statement_sequences_pkey" PRIMARY KEY ("year")
);

CREATE UNIQUE INDEX IF NOT EXISTS "billing_statements_number_key"
  ON "finance_ops"."billing_statements"("number");
