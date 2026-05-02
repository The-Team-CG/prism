ALTER TABLE "mvp_events"
ADD COLUMN IF NOT EXISTS "floor_plan_status" TEXT NOT NULL DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS "floor_plan_id" TEXT,
ADD COLUMN IF NOT EXISTS "floor_plan_submitted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "floor_plan_reviewed_at" TIMESTAMP(3);

ALTER TABLE "documents"
ADD COLUMN IF NOT EXISTS "mime_type" TEXT,
ADD COLUMN IF NOT EXISTS "size_bytes" INTEGER,
ADD COLUMN IF NOT EXISTS "storage_bucket" TEXT,
ADD COLUMN IF NOT EXISTS "storage_key" TEXT,
ADD COLUMN IF NOT EXISTS "uploaded_by_role" TEXT;

ALTER TABLE "supplier_quotes"
ADD COLUMN IF NOT EXISTS "request_id" TEXT;

CREATE TABLE IF NOT EXISTS "event_comments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "author_role" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "supplier_quote_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_quote_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "event_comments_event_id_topic_idx" ON "event_comments"("event_id", "topic");
CREATE INDEX IF NOT EXISTS "supplier_quote_requests_event_id_status_idx" ON "supplier_quote_requests"("event_id", "status");
