ALTER TABLE "ops_inquiries"
  ADD COLUMN "normalized_email" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "referral_details" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "logged_by_role" TEXT,
  ADD COLUMN "logged_by_name" TEXT,
  ADD COLUMN "duplicate_of_inquiry_id" TEXT,
  ADD COLUMN "previous_declined_inquiry_id" TEXT,
  ADD COLUMN "previous_decline_reason" TEXT;

UPDATE "ops_inquiries"
SET "normalized_email" = lower(trim("email"))
WHERE "normalized_email" = '';

CREATE INDEX "ops_inquiries_normalized_email_event_date_idx"
  ON "ops_inquiries"("normalized_email", "event_date");

CREATE INDEX "ops_inquiries_duplicate_of_inquiry_id_idx"
  ON "ops_inquiries"("duplicate_of_inquiry_id");

CREATE INDEX "ops_inquiries_previous_declined_inquiry_id_idx"
  ON "ops_inquiries"("previous_declined_inquiry_id");
