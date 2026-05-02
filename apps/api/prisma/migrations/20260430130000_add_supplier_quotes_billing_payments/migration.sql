-- FR-17, FR-19, FR-20: supplier quote requests, billing statements, and manual payment tracking.

ALTER TABLE "ops_supplier_categories"
  ADD COLUMN "acceptable_min" INTEGER,
  ADD COLUMN "acceptable_max" INTEGER;

UPDATE "ops_supplier_categories"
SET
  "acceptable_min" = CASE "slug"
    WHEN 'production' THEN 180000
    WHEN 'technicals' THEN 120000
    WHEN 'digital-registration' THEN 45000
    WHEN 'documentation' THEN 65000
    WHEN 'food-and-beverages' THEN 140000
    WHEN 'talents' THEN 50000
    WHEN 'logistics' THEN 30000
    WHEN 'program-and-manpower' THEN 45000
    ELSE 25000
  END,
  "acceptable_max" = CASE "slug"
    WHEN 'production' THEN 280000
    WHEN 'technicals' THEN 180000
    WHEN 'digital-registration' THEN 90000
    WHEN 'documentation' THEN 120000
    WHEN 'food-and-beverages' THEN 220000
    WHEN 'talents' THEN 120000
    WHEN 'logistics' THEN 70000
    WHEN 'program-and-manpower' THEN 95000
    ELSE 150000
  END;

ALTER TABLE "ops_supplier_quote_requests"
  ADD COLUMN "supplier_id" TEXT,
  ADD COLUMN "category_id" TEXT,
  ADD COLUMN "access_token" TEXT,
  ADD COLUMN "confidential_bid" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ops_supplier_quote_requests"
SET "access_token" = "id"
WHERE "access_token" IS NULL;

ALTER TABLE "ops_supplier_quote_requests"
  ALTER COLUMN "access_token" SET NOT NULL;

CREATE UNIQUE INDEX "ops_supplier_quote_requests_access_token_key"
  ON "ops_supplier_quote_requests"("access_token");
CREATE INDEX "ops_supplier_quote_requests_supplier_id_idx"
  ON "ops_supplier_quote_requests"("supplier_id");
CREATE INDEX "ops_supplier_quote_requests_category_id_idx"
  ON "ops_supplier_quote_requests"("category_id");

ALTER TABLE "ops_supplier_quote_requests"
  ADD CONSTRAINT "ops_supplier_quote_requests_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "ops_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ops_supplier_quote_requests_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "ops_supplier_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_supplier_quotes"
  ADD COLUMN "category_id" TEXT,
  ADD COLUMN "inclusions" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "payment_terms" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "notes" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "acceptable_min" INTEGER,
  ADD COLUMN "acceptable_max" INTEGER,
  ADD COLUMN "outside_acceptable_range" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "selected_at" TIMESTAMP(3);

CREATE INDEX "ops_supplier_quotes_category_id_idx"
  ON "ops_supplier_quotes"("category_id");

ALTER TABLE "ops_supplier_quotes"
  ADD CONSTRAINT "ops_supplier_quotes_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "ops_supplier_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_billing_statements"
  ADD COLUMN "client_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "client_contact" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "event_name" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "event_date" TIMESTAMP(3),
  ADD COLUMN "line_items" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "payment_schedule" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "payment_methods" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "document_id" TEXT,
  ADD COLUMN "pdf_url" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "storage_key" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sent_at" TIMESTAMP(3);

UPDATE "ops_billing_statements" AS bill
SET
  "client_name" = event."client_name",
  "event_name" = event."event_name",
  "event_date" = event."event_date",
  "line_items" = jsonb_build_array(jsonb_build_object('label', 'Approved event package', 'amount', bill."total_amount")),
  "payment_schedule" = jsonb_build_array(
    jsonb_build_object('label', 'Downpayment', 'percentage', 50, 'amount', floor(bill."total_amount" / 2)),
    jsonb_build_object('label', 'Balance', 'percentage', 50, 'amount', bill."total_amount" - floor(bill."total_amount" / 2))
  ),
  "payment_methods" = jsonb_build_array(
    jsonb_build_object('label', 'Bank Transfer', 'details', 'PMCM corporate bank account'),
    jsonb_build_object('label', 'GCash', 'details', 'PMCM finance GCash number'),
    jsonb_build_object('label', 'Cheque', 'details', 'Payable to PMCM Events Management')
  )
FROM "ops_events" AS event
WHERE bill."event_id" = event."id";

ALTER TABLE "ops_payment_milestones"
  ADD COLUMN "percentage" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "amount_paid" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "remaining_balance" INTEGER NOT NULL DEFAULT 0;

UPDATE "ops_payment_milestones"
SET
  "amount_paid" = CASE WHEN "status" = 'paid' THEN "amount" ELSE 0 END,
  "remaining_balance" = CASE WHEN "status" = 'paid' THEN 0 ELSE "amount" END;

CREATE TABLE "ops_payment_records" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "milestone_id" TEXT NOT NULL,
  "amount_received" INTEGER NOT NULL,
  "payment_date" TIMESTAMP(3) NOT NULL,
  "payment_method" TEXT NOT NULL,
  "reference_number" TEXT NOT NULL DEFAULT '',
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_payment_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_payment_records_event_id_recorded_at_idx"
  ON "ops_payment_records"("event_id", "recorded_at");
CREATE INDEX "ops_payment_records_milestone_id_recorded_at_idx"
  ON "ops_payment_records"("milestone_id", "recorded_at");

ALTER TABLE "ops_payment_records"
  ADD CONSTRAINT "ops_payment_records_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ops_payment_records_milestone_id_fkey"
  FOREIGN KEY ("milestone_id") REFERENCES "ops_payment_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
