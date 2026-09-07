-- Additive only: historical events have no inferred actual end; historical
-- applications/notes keep null provenance until a verified operation records it.
ALTER TABLE "event_core"."events"
  ADD COLUMN "actual_ended_at" TIMESTAMP(3),
  ADD COLUMN "actual_ended_by" TEXT;

ALTER TABLE "supplier_ops"."supplier_applications"
  ADD COLUMN "converted_supplier_id" TEXT,
  ADD COLUMN "conversion_idempotency_key" TEXT,
  ADD COLUMN "conversion_payload_hash" TEXT;

CREATE UNIQUE INDEX "supplier_applications_converted_supplier_id_key"
  ON "supplier_ops"."supplier_applications"("converted_supplier_id");
CREATE UNIQUE INDEX "supplier_applications_conversion_idempotency_key_key"
  ON "supplier_ops"."supplier_applications"("conversion_idempotency_key");
ALTER TABLE "supplier_ops"."supplier_applications"
  ADD CONSTRAINT "supplier_applications_converted_supplier_id_fkey"
  FOREIGN KEY ("converted_supplier_id") REFERENCES "supplier_ops"."suppliers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supplier_ops"."supplier_reliability_notes"
  ADD COLUMN "created_by" TEXT,
  ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "supplier_reliability_notes_idempotency_key_key"
  ON "supplier_ops"."supplier_reliability_notes"("idempotency_key");

CREATE TABLE "supplier_ops"."supplier_promotions" (
  "id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "review_id" TEXT NOT NULL,
  "from_tier" TEXT NOT NULL,
  "to_tier" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "promoted_by" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "payload_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_promotions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_promotions_supplier_id_fkey" FOREIGN KEY ("supplier_id")
    REFERENCES "supplier_ops"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_promotions_review_id_fkey" FOREIGN KEY ("review_id")
    REFERENCES "supplier_ops"."supplier_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "supplier_promotions_idempotency_key_key"
  ON "supplier_ops"."supplier_promotions"("idempotency_key");
CREATE INDEX "supplier_promotions_supplier_id_created_at_idx"
  ON "supplier_ops"."supplier_promotions"("supplier_id", "created_at");
CREATE INDEX "supplier_promotions_review_id_idx"
  ON "supplier_ops"."supplier_promotions"("review_id");
