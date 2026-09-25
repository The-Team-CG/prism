-- prism-owner: platform-ops
-- prism-kind: mixed
-- prism-risk: high
-- PMCM review content is separate from sanitized AI audit metadata.

CREATE TABLE "trust_ops"."conforme_comms_drafts" (
  "id" TEXT NOT NULL,
  "inquiry_id" TEXT NOT NULL,
  "reminder_window_base_at" TEXT NOT NULL,
  "decision_reminder_at" TEXT,
  "request_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conforme_comms_drafts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conforme_comms_drafts_id_fkey"
    FOREIGN KEY ("id") REFERENCES "trust_ops"."ai_approval_records"("id")
    ON DELETE CASCADE,
  CONSTRAINT "conforme_comms_drafts_source_check"
    CHECK ("source" IN ('ai', 'manual'))
);

CREATE INDEX "conforme_comms_drafts_inquiry_id_created_at_idx"
  ON "trust_ops"."conforme_comms_drafts"("inquiry_id", "created_at");

-- Preserve valid drafts created before this split, then remove all draft text
-- from the legacy audit JSON. Invalid legacy payloads remain unreviewable.
INSERT INTO "trust_ops"."conforme_comms_drafts" (
  "id", "inquiry_id", "reminder_window_base_at", "decision_reminder_at",
  "request_id", "source", "subject", "body", "created_at"
)
SELECT
  "trust_ops"."ai_approval_records"."id",
  "trust_ops"."ai_audit_logs"."sanitized_payload"->>'inquiryId',
  "trust_ops"."ai_audit_logs"."sanitized_payload"->>'reminderWindowBaseAt',
  "trust_ops"."ai_audit_logs"."sanitized_payload"->>'decisionReminderAt',
  "trust_ops"."ai_audit_logs"."sanitized_payload"->>'requestId',
  "trust_ops"."ai_audit_logs"."sanitized_payload"->>'source',
  "trust_ops"."ai_audit_logs"."sanitized_payload"->'draft'->>'subject',
  "trust_ops"."ai_audit_logs"."sanitized_payload"->'draft'->>'body',
  "trust_ops"."ai_audit_logs"."created_at"
FROM "trust_ops"."ai_approval_records"
JOIN "trust_ops"."ai_audit_logs" ON "trust_ops"."ai_audit_logs"."id" = "trust_ops"."ai_approval_records"."ai_audit_log_id"
WHERE "trust_ops"."ai_approval_records"."feature_name" = 'FR-AI-09'
  AND "trust_ops"."ai_audit_logs"."feature_name" = 'FR-AI-09'
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->>'source' IN ('ai', 'manual')
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->>'inquiryId' IS NOT NULL
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->>'requestId' IS NOT NULL
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->>'reminderWindowBaseAt' IS NOT NULL
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->'draft'->>'subject' IS NOT NULL
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->'draft'->>'body' IS NOT NULL;

UPDATE "trust_ops"."ai_audit_logs"
SET "sanitized_payload" = jsonb_build_object(
      'source', CASE WHEN "trust_ops"."ai_audit_logs"."sanitized_payload"->>'source' IN ('ai', 'manual')
        THEN "trust_ops"."ai_audit_logs"."sanitized_payload"->>'source' ELSE 'unknown' END,
      'draftRecordId', COALESCE((
        SELECT "trust_ops"."conforme_comms_drafts"."id"
        FROM "trust_ops"."conforme_comms_drafts"
        JOIN "trust_ops"."ai_approval_records"
          ON "trust_ops"."ai_approval_records"."id" = "trust_ops"."conforme_comms_drafts"."id"
        WHERE "trust_ops"."ai_approval_records"."ai_audit_log_id" = "trust_ops"."ai_audit_logs"."id"
          AND "trust_ops"."ai_approval_records"."feature_name" = 'FR-AI-09'
        ORDER BY "trust_ops"."ai_approval_records"."requested_at" DESC LIMIT 1
      ), '')
    ),
    "data_categories" = '["personal"]'::jsonb
WHERE "trust_ops"."ai_audit_logs"."feature_name" = 'FR-AI-09';

-- Older blocked gateway attempts could retain a real inquiry ID in gateway
-- metadata even though no provider call completed.
UPDATE "trust_ops"."ai_audit_logs"
SET "sanitized_payload" = '{}'::jsonb,
    "data_categories" = '["personal"]'::jsonb,
    "correlation_id" = NULL
WHERE "trust_ops"."ai_audit_logs"."feature_name" = 'comms.draft'
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->>'inquiryId' IS NOT NULL
  AND "trust_ops"."ai_audit_logs"."sanitized_payload"->>'inquiryId' <> 'ai-fixture-inquiry-v1';
