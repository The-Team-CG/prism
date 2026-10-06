-- prism-owner: platform-ops
-- prism-kind: mixed
-- prism-risk: medium

-- AI governance records stay inside the platform_ops schema and keep their provenance:
--   * an approval record must name an AI audit log that exists. The audit log is evidence, so it cannot be deleted
--     while an approval depends on it (RESTRICT). An approval whose audit log is missing aborts the migration so an
--     owner decides explicitly; nothing is deleted.
--   * a PARE dispatch may name the approval record it produced. The dispatch is replayable job state, so a legacy
--     dispatch that points at a missing approval record has the link cleared to NULL and keeps running. The approval
--     record itself cannot be deleted while a dispatch names it.
-- The event_id columns remain external references with no foreign key, and they are nullable on the approval and
-- audit tables, so event agreement between the records is checked by the governance service, not by a composite key.

CREATE INDEX "pare_dispatches_approval_record_id_idx" ON "platform_ops"."pare_dispatches" ("approval_record_id");

UPDATE "platform_ops"."pare_dispatches"
SET "approval_record_id" = NULL
WHERE "approval_record_id" IS NOT NULL
  AND "approval_record_id" NOT IN (SELECT "id" FROM "platform_ops"."ai_approval_records");

ALTER TABLE "platform_ops"."ai_approval_records"
  ADD CONSTRAINT "ai_approval_records_ai_audit_log_id_fkey"
  FOREIGN KEY ("ai_audit_log_id") REFERENCES "platform_ops"."ai_audit_logs" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "platform_ops"."ai_approval_records" VALIDATE CONSTRAINT "ai_approval_records_ai_audit_log_id_fkey";

ALTER TABLE "platform_ops"."pare_dispatches"
  ADD CONSTRAINT "pare_dispatches_approval_record_id_fkey"
  FOREIGN KEY ("approval_record_id") REFERENCES "platform_ops"."ai_approval_records" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "platform_ops"."pare_dispatches" VALIDATE CONSTRAINT "pare_dispatches_approval_record_id_fkey";
