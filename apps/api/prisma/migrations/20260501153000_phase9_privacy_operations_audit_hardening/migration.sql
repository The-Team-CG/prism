CREATE TABLE "ops_privacy_requests" (
  "id" TEXT NOT NULL,
  "event_id" TEXT,
  "subject_type" TEXT NOT NULL,
  "subject_email" TEXT NOT NULL DEFAULT '',
  "subject_name" TEXT NOT NULL DEFAULT '',
  "request_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'submitted',
  "request_notes" TEXT NOT NULL DEFAULT '',
  "review_reason" TEXT NOT NULL DEFAULT '',
  "execution_notes" TEXT NOT NULL DEFAULT '',
  "created_by" TEXT NOT NULL DEFAULT 'PMCM Admin',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "executed_by" TEXT,
  "executed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ops_privacy_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_privacy_requests_status_created_at_idx"
  ON "ops_privacy_requests"("status", "created_at");

CREATE INDEX "ops_privacy_requests_subject_email_idx"
  ON "ops_privacy_requests"("subject_email");

CREATE INDEX "ops_privacy_requests_event_id_idx"
  ON "ops_privacy_requests"("event_id");

ALTER TABLE "ops_privacy_requests"
  ADD CONSTRAINT "ops_privacy_requests_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "ops_events"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
