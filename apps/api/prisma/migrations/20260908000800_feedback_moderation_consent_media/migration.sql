ALTER TABLE "guest_ops"."feedback"
  ADD COLUMN "moderation_reason" TEXT,
  ADD COLUMN "moderated_by_id" TEXT,
  ADD COLUMN "moderated_by" TEXT,
  ADD COLUMN "moderated_at" TIMESTAMP(3),
  ADD COLUMN "privacy_consent_withdrawn_at" TIMESTAMP(3),
  ADD COLUMN "marketing_consent_withdrawn_at" TIMESTAMP(3);

CREATE TABLE "guest_ops"."feedback_media" (
  "id" TEXT NOT NULL,
  "feedback_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "original_file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_storage',
  "blocker" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feedback_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feedback_media_feedback_id_fkey" FOREIGN KEY ("feedback_id") REFERENCES "guest_ops"."feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "feedback_media_feedback_id_idx" ON "guest_ops"."feedback_media"("feedback_id");
