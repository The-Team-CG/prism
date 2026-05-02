ALTER TABLE "ops_inquiries"
ADD COLUMN IF NOT EXISTS "company_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS "event_type" TEXT NOT NULL DEFAULT 'Event',
ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'Website',
ADD COLUMN IF NOT EXISTS "decline_reason" TEXT,
ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "pending_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "conforme_sent_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "conforme_signed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "portal_activated_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "follow_up_interval_days" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN IF NOT EXISTS "last_conforme_reminder_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "portal_invitation_status" TEXT NOT NULL DEFAULT 'not_sent',
ADD COLUMN IF NOT EXISTS "portal_invitation_sent_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "portal_invitation_opened_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "portal_invitation_expires_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ops_inquiries_source_created_at_idx"
ON "ops_inquiries"("source", "created_at");

CREATE INDEX IF NOT EXISTS "ops_inquiries_client_type_created_at_idx"
ON "ops_inquiries"("client_type", "created_at");
