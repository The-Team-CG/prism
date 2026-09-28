-- prism-owner: platform-ops
-- prism-kind: mixed
-- prism-risk: high
-- Keep PMCM-only PARE review content out of the sanitized AI audit log.

ALTER TABLE "trust_ops"."ai_approval_records"
  ADD COLUMN "review_payload" JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Preserve existing sanitized PARE recommendations and drafts on the approval
-- record before removing them from the audit log.
UPDATE "trust_ops"."ai_approval_records"
SET "review_payload" = COALESCE("trust_ops"."ai_audit_logs"."sanitized_payload", '{}'::jsonb) - 'runEvidence'
FROM "trust_ops"."ai_audit_logs"
WHERE "trust_ops"."ai_audit_logs"."id" = "trust_ops"."ai_approval_records"."ai_audit_log_id"
  AND "trust_ops"."ai_approval_records"."feature_name" = 'PARE'
  AND "trust_ops"."ai_audit_logs"."feature_name" = 'PARE';

UPDATE "trust_ops"."ai_audit_logs"
SET "sanitized_payload" = jsonb_strip_nulls(jsonb_build_object(
      'requestId', COALESCE(NULLIF("sanitized_payload"->>'requestId', ''), NULLIF("sanitized_payload"->>'triggerId', '')),
      'eventId', COALESCE("event_id", NULLIF("sanitized_payload"->>'eventId', '')),
      'mode', NULLIF("sanitized_payload"->>'mode', ''),
      'runEvidence', CASE
        WHEN jsonb_typeof("sanitized_payload"->'runEvidence') = 'array' THEN "sanitized_payload"->'runEvidence'
        ELSE '[]'::jsonb
      END,
      'triggeredAt', COALESCE(NULLIF("sanitized_payload"->>'triggeredAt', ''), "created_at"::text)
    ))
WHERE "feature_name" = 'PARE';
