-- Phase 3 supplier, quote, and floorplan hardening metadata.

ALTER TABLE "ops_floor_plan_drafts"
  ADD COLUMN "submitted_snapshot" JSONB,
  ADD COLUMN "approved_snapshot" JSONB,
  ADD COLUMN "submitted_snapshot_at" TIMESTAMP(3),
  ADD COLUMN "approved_snapshot_at" TIMESTAMP(3),
  ADD COLUMN "revision_comment" TEXT NOT NULL DEFAULT '';

ALTER TABLE "ops_supplier_quotes"
  ADD COLUMN "revision_number" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "revised_at" TIMESTAMP(3),
  ADD COLUMN "locked_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ops_supplier_certifications"
  ADD COLUMN "document_type" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "issuer" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'submitted',
  ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
