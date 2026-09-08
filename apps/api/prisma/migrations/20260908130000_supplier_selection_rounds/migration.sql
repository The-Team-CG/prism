CREATE TABLE "supplier_ops"."supplier_availability" (
  "id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "available_on" DATE NOT NULL,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "blocked" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_availability_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supplier_availability_supplier_date_key" ON "supplier_ops"."supplier_availability"("supplier_id", "available_on");
CREATE INDEX "supplier_availability_date_blocked_idx" ON "supplier_ops"."supplier_availability"("available_on", "blocked");
ALTER TABLE "supplier_ops"."supplier_availability" ADD CONSTRAINT "supplier_availability_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "supplier_ops"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "supplier_ops"."quote_rounds" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "round_number" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'open',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMP(3),
  CONSTRAINT "quote_rounds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "supplier_quote_rounds_event_category_number_key" ON "supplier_ops"."quote_rounds"("event_id", "category_id", "round_number");
CREATE INDEX "supplier_quote_rounds_event_category_status_idx" ON "supplier_ops"."quote_rounds"("event_id", "category_id", "status");
ALTER TABLE "supplier_ops"."quote_rounds" ADD CONSTRAINT "quote_rounds_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ops"."quote_rounds" ADD CONSTRAINT "quote_rounds_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "supplier_ops"."supplier_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_ops"."quote_requests" ADD COLUMN "round_id" TEXT;
CREATE INDEX "quote_requests_round_id_idx" ON "supplier_ops"."quote_requests"("round_id");
ALTER TABLE "supplier_ops"."quote_requests" ADD CONSTRAINT "quote_requests_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "supplier_ops"."quote_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
