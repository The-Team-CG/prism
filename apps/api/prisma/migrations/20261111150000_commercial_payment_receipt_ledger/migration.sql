-- prism-owner: commercial
-- prism-kind: mixed
-- prism-risk: medium

-- Receipt ledger for payments made outside P.R.I.S.M. A receipt is money that arrived; payment records become the
-- amounts applied from a receipt to a milestone, and a reversal is a record with a negative amount that points at the
-- record it undoes, so every existing sum over payment_records stays correct. Touches only commercial tables.

-- Deploy precondition: payment records are positive today. The new sign rule needs it, so fail loudly (naming the
-- rows) instead of rewriting any. This migration deletes nothing.
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM "commercial"."payment_records" WHERE "amount_received" <= 0
) THEN CAST(
  'payment_records has rows with a zero or negative amount_received that block the payment_records_sign_check constraint; resolve them manually, this migration deletes nothing: ' || (
    SELECT string_agg("id", ', ' ORDER BY "id") FROM "commercial"."payment_records" WHERE "amount_received" <= 0
  ) AS INTEGER
) ELSE 0 END;

-- CreateTable
CREATE TABLE "commercial"."payment_receipts" (
    "id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "received_date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL DEFAULT '',
    "reference_key" TEXT,
    "payer_name" TEXT NOT NULL DEFAULT '',
    "event_id" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "evidence_object_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_notes" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "reversed_at" TIMESTAMP(3),
    "reversed_by" TEXT,
    "reversal_reason" TEXT,
    "possible_duplicate_of_id" TEXT,
    "recorded_by" TEXT NOT NULL,
    "recorded_by_id" TEXT,
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_receipts_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "payment_receipts_status_check" CHECK ("status" IN ('recorded', 'verified', 'rejected', 'reversed'))
);

-- CreateTable
CREATE TABLE "commercial"."payment_refunds" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "refunded_date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_by_id" TEXT,
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_refunds_amount_check" CHECK ("amount" > 0)
);

-- AlterTable
ALTER TABLE "commercial"."payment_records"
    ADD COLUMN "receipt_id" TEXT,
    ADD COLUMN "reverses_record_id" TEXT,
    ADD COLUMN "reversal_reason" TEXT,
    ADD COLUMN "recorded_by" TEXT;

-- Backfill: every existing payment record becomes its own legacy receipt, so no applied money is left without a
-- receipt. Legacy receipts carry no reference key: one bank transfer was sometimes recorded against two milestones
-- with the same reference, and the duplicate rule below must apply only to receipts recorded from now on.
INSERT INTO "commercial"."payment_receipts" (
    "id", "amount", "received_date", "method", "reference_number", "event_id", "notes", "status", "recorded_by", "created_at", "updated_at"
)
SELECT 'prcp_legacy_' || "id", "amount_received", "payment_date", "payment_method", "reference_number", "event_id",
       'Carried over from a payment record made before receipts existed. No evidence on file.', 'recorded', 'Migration', "recorded_at", "recorded_at"
FROM "commercial"."payment_records"
WHERE "receipt_id" IS NULL;

UPDATE "commercial"."payment_records" SET "receipt_id" = 'prcp_legacy_' || "id" WHERE "receipt_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_idempotency_key_key" ON "commercial"."payment_receipts"("idempotency_key");
CREATE INDEX "payment_receipts_status_received_date_idx" ON "commercial"."payment_receipts"("status", "received_date");
CREATE INDEX "payment_receipts_event_id_received_date_idx" ON "commercial"."payment_receipts"("event_id", "received_date");
CREATE UNIQUE INDEX "payment_refunds_idempotency_key_key" ON "commercial"."payment_refunds"("idempotency_key");
CREATE INDEX "payment_refunds_receipt_id_created_at_idx" ON "commercial"."payment_refunds"("receipt_id", "created_at");
CREATE UNIQUE INDEX "payment_records_reverses_record_id_key" ON "commercial"."payment_records"("reverses_record_id");
CREATE INDEX "payment_records_receipt_id_idx" ON "commercial"."payment_records"("receipt_id");

-- One receipt per payment reference: a bank reference identifies one transfer. Only a receipt that still counts holds its
-- reference key; a reversed or rejected one gives it up, so a corrected entry can be recorded. A plain unique index does
-- the work (null keys, for legacy receipts and receipts without a reference, never collide), and the check below keeps
-- the key and the status from disagreeing.
CREATE UNIQUE INDEX "payment_receipts_method_reference_key_key" ON "commercial"."payment_receipts"("method", "reference_key");
ALTER TABLE "commercial"."payment_receipts" ADD CONSTRAINT "payment_receipts_reference_key_live_check" CHECK (
    "reference_key" IS NULL OR "status" IN ('recorded', 'verified')
);

-- AddForeignKey
ALTER TABLE "commercial"."payment_records" ADD CONSTRAINT "payment_records_receipt_fkey" FOREIGN KEY ("receipt_id") REFERENCES "commercial"."payment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial"."payment_records" ADD CONSTRAINT "payment_records_reverses_record_fkey" FOREIGN KEY ("reverses_record_id") REFERENCES "commercial"."payment_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial"."payment_refunds" ADD CONSTRAINT "payment_refunds_receipt_fkey" FOREIGN KEY ("receipt_id") REFERENCES "commercial"."payment_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A payment adds money; only a reversal subtracts, and it must say which payment it undoes.
ALTER TABLE "commercial"."payment_records" ADD CONSTRAINT "payment_records_sign_check" CHECK (
    ("reverses_record_id" IS NULL AND "amount_received" > 0) OR ("reverses_record_id" IS NOT NULL AND "amount_received" < 0)
);
