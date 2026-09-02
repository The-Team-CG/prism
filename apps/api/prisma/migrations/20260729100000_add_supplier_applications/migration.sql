-- CreateTable: supplier_applications
CREATE TABLE "supplier_ops"."supplier_applications" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "category_id" TEXT,
    "past_events" TEXT NOT NULL DEFAULT '',
    "service_inclusions" TEXT NOT NULL DEFAULT '',
    "certifications" TEXT NOT NULL DEFAULT '',
    "price_range" TEXT NOT NULL DEFAULT '',
    "bni_member" BOOLEAN NOT NULL DEFAULT false,
    "portfolio_url" TEXT NOT NULL DEFAULT '',
    "additional_notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decline_reason" TEXT,
    "reviewed_at" TIMESTAMPTZ,
    "approved_at" TIMESTAMPTZ,
    "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "supplier_applications_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "supplier_ops"."supplier_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex: composite index on normalized_email + created_at for 14-day duplicate detection
CREATE INDEX "supplier_applications_normalized_email_created_at_idx" ON "supplier_ops"."supplier_applications"("normalized_email", "created_at");

-- CreateIndex: index on status for filtering
CREATE INDEX "supplier_applications_status_idx" ON "supplier_ops"."supplier_applications"("status");
