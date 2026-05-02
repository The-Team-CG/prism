CREATE TABLE IF NOT EXISTS "ops_supplier_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_supplier_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_suppliers" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL DEFAULT 'pending_first_event',
    "bni_member" BOOLEAN NOT NULL DEFAULT false,
    "service_inclusions" TEXT NOT NULL DEFAULT '',
    "performance_notes" TEXT NOT NULL DEFAULT '',
    "application_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_supplier_reviews" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "event_id" TEXT,
    "rating" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "reviewed_by" TEXT NOT NULL DEFAULT 'PMCM Admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_supplier_reviews_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_supplier_reliability_notes" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "event_id" TEXT,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_supplier_reliability_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_supplier_certifications" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_supplier_certifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ops_supplier_quotes"
ADD COLUMN IF NOT EXISTS "supplier_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ops_supplier_categories_slug_key"
ON "ops_supplier_categories"("slug");

CREATE INDEX IF NOT EXISTS "ops_supplier_categories_active_sort_order_idx"
ON "ops_supplier_categories"("active", "sort_order");

CREATE INDEX IF NOT EXISTS "ops_suppliers_category_id_tier_idx"
ON "ops_suppliers"("category_id", "tier");

CREATE INDEX IF NOT EXISTS "ops_suppliers_bni_member_idx"
ON "ops_suppliers"("bni_member");

CREATE INDEX IF NOT EXISTS "ops_supplier_quotes_supplier_id_idx"
ON "ops_supplier_quotes"("supplier_id");

CREATE INDEX IF NOT EXISTS "ops_supplier_reviews_supplier_id_created_at_idx"
ON "ops_supplier_reviews"("supplier_id", "created_at");

CREATE INDEX IF NOT EXISTS "ops_supplier_reviews_event_id_idx"
ON "ops_supplier_reviews"("event_id");

CREATE INDEX IF NOT EXISTS "ops_supplier_reliability_notes_supplier_id_created_at_idx"
ON "ops_supplier_reliability_notes"("supplier_id", "created_at");

CREATE INDEX IF NOT EXISTS "ops_supplier_reliability_notes_event_id_idx"
ON "ops_supplier_reliability_notes"("event_id");

CREATE INDEX IF NOT EXISTS "ops_supplier_certifications_supplier_id_uploaded_at_idx"
ON "ops_supplier_certifications"("supplier_id", "uploaded_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ops_suppliers_category_id_fkey'
    ) THEN
        ALTER TABLE "ops_suppliers" ADD CONSTRAINT "ops_suppliers_category_id_fkey"
        FOREIGN KEY ("category_id") REFERENCES "ops_supplier_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ops_supplier_quotes_supplier_id_fkey'
    ) THEN
        ALTER TABLE "ops_supplier_quotes" ADD CONSTRAINT "ops_supplier_quotes_supplier_id_fkey"
        FOREIGN KEY ("supplier_id") REFERENCES "ops_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ops_supplier_reviews_supplier_id_fkey'
    ) THEN
        ALTER TABLE "ops_supplier_reviews" ADD CONSTRAINT "ops_supplier_reviews_supplier_id_fkey"
        FOREIGN KEY ("supplier_id") REFERENCES "ops_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ops_supplier_reviews_event_id_fkey'
    ) THEN
        ALTER TABLE "ops_supplier_reviews" ADD CONSTRAINT "ops_supplier_reviews_event_id_fkey"
        FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ops_supplier_reliability_notes_supplier_id_fkey'
    ) THEN
        ALTER TABLE "ops_supplier_reliability_notes" ADD CONSTRAINT "ops_supplier_reliability_notes_supplier_id_fkey"
        FOREIGN KEY ("supplier_id") REFERENCES "ops_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ops_supplier_reliability_notes_event_id_fkey'
    ) THEN
        ALTER TABLE "ops_supplier_reliability_notes" ADD CONSTRAINT "ops_supplier_reliability_notes_event_id_fkey"
        FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ops_supplier_certifications_supplier_id_fkey'
    ) THEN
        ALTER TABLE "ops_supplier_certifications" ADD CONSTRAINT "ops_supplier_certifications_supplier_id_fkey"
        FOREIGN KEY ("supplier_id") REFERENCES "ops_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
