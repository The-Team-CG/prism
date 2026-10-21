-- prism-owner: platform-ops
-- prism-kind: mixed
-- prism-risk: medium
-- Persisted privacy retention policies and the PMCM review queue. Additive tables plus disabled seed rows only;
-- no policy is enabled here, and nothing is swept, deleted, or anonymized by this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateTable
CREATE TABLE "platform_ops"."retention_policies" (
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "period_days" INTEGER NOT NULL,
    "anchor" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'review_anonymize',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updated_by" TEXT NOT NULL DEFAULT '',
    "history" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("category")
);

-- CreateTable
CREATE TABLE "platform_ops"."retention_review_items" (
    "id" TEXT NOT NULL,
    "policy_category" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "event_id" TEXT,
    "subject_email" TEXT NOT NULL DEFAULT '',
    "subject_name" TEXT NOT NULL DEFAULT '',
    "anchor_at" TIMESTAMP(3) NOT NULL,
    "due_since" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decision_reason" TEXT NOT NULL DEFAULT '',
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "retention_review_items_subject_key" ON "platform_ops"."retention_review_items"("policy_category", "subject_type", "subject_id");

-- CreateIndex
CREATE INDEX "retention_review_items_status_due_since_idx" ON "platform_ops"."retention_review_items"("status", "due_since");

-- CreateIndex
CREATE INDEX "retention_review_items_event_id_idx" ON "platform_ops"."retention_review_items"("event_id");

-- Seed disabled default policies. Periods are conservative defaults pending PMCM (owner D) confirmation.
INSERT INTO "platform_ops"."retention_policies" ("category", "label", "description", "period_days", "anchor", "action", "enabled", "revision", "updated_by")
VALUES
    ('inquiry', 'Client inquiry and event contact', 'Soft redact personal contact and free-text fields; keep event linkage.', 730, 'event_archived_at', 'review_anonymize', false, 1, 'migration'),
    ('approval_request', 'Approval request identity', 'Soft redact requester identity; keep approval decision history.', 730, 'record_created_at', 'review_anonymize', false, 1, 'migration'),
    ('supplier', 'Supplier contact and performance records', 'Soft redact supplier contact details when legally required; keep operational history.', 2555, 'record_created_at', 'review_anonymize', false, 1, 'migration'),
    ('guest_check_in', 'Guest check-in', 'Soft redact guest name; keep attendance count and event-day aggregate.', 730, 'event_archived_at', 'review_anonymize', false, 1, 'migration'),
    ('guest_feedback', 'Guest feedback', 'Soft redact guest name, comments, and media metadata; keep moderation status.', 730, 'event_archived_at', 'review_anonymize', false, 1, 'migration'),
    ('documents', 'Event document metadata', 'Keep metadata unless PMCM executes a document-specific redaction workflow.', 2555, 'event_archived_at', 'review_anonymize', false, 1, 'migration'),
    ('audit', 'Audit log', 'Never hard delete or mutate in normal workflows; append redaction events instead.', 2555, 'record_created_at', 'review_anonymize', false, 1, 'migration'),
    ('legal_hold', 'Privacy legal hold', 'Only a verified PMCM administrator can release a hold; active holds block matching deletion execution.', 2555, 'record_created_at', 'review_anonymize', false, 1, 'migration')
ON CONFLICT ("category") DO NOTHING;

COMMIT;
