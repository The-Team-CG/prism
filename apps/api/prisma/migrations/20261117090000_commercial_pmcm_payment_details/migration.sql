-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: low

-- PMCM keeps one set of payment details for the company (bank accounts, e-wallets, cheque payee), each optionally with
-- a QR image the client scans. The details are one row edited with a revision check; QR images are small, never
-- changed after upload, and stored by content hash so a repeated upload is the same image. Adds two commercial tables.

-- CreateTable
CREATE TABLE "commercial"."pmcm_payment_details" (
    "id" TEXT NOT NULL,
    "methods" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "updated_by" TEXT NOT NULL DEFAULT '',
    "history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pmcm_payment_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."pmcm_payment_qr_images" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "byte_size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pmcm_payment_qr_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pmcm_payment_qr_images_sha256_key" ON "commercial"."pmcm_payment_qr_images"("sha256");
