-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- AlterTable
ALTER TABLE "commercial"."supplier_schedules" ADD COLUMN     "acknowledged_at" TIMESTAMP(3),
ADD COLUMN     "acknowledged_by" TEXT,
ADD COLUMN     "acknowledged_revision" INTEGER,
ADD COLUMN     "change_request_note" TEXT,
ADD COLUMN     "change_requested_at" TIMESTAMP(3),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "commercial"."supplier_contract_versions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "document_id" TEXT,
    "stored_object_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "review_status" TEXT NOT NULL DEFAULT 'submitted',
    "review_reason" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_creative_tasks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL,
    "due_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "supplier_progress_note" TEXT NOT NULL DEFAULT '',
    "submission_object_id" TEXT,
    "submission_note" TEXT,
    "submission_version" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_creative_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_creative_submissions" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stored_object_id" TEXT,
    "note" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_creative_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_payable_milestones" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payable_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_payout_records" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "notes" TEXT,
    "reverses_record_id" TEXT,
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payout_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."client_review_items" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "budget_range" TEXT,
    "document_id" TEXT,
    "created_by" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."client_review_decisions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "item_version" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT NOT NULL DEFAULT '',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_review_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_contract_versions_object_key" ON "commercial"."supplier_contract_versions"("stored_object_id");

-- CreateIndex
CREATE INDEX "supplier_contract_versions_event_id_idx" ON "commercial"."supplier_contract_versions"("event_id");

-- CreateIndex
CREATE INDEX "supplier_contract_versions_request_created_idx" ON "commercial"."supplier_contract_versions"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "supplier_contract_versions_supplier_event_idx" ON "commercial"."supplier_contract_versions"("supplier_id", "event_id");

-- CreateIndex
CREATE INDEX "supplier_contract_versions_document_id_idx" ON "commercial"."supplier_contract_versions"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_contract_versions_request_version_key" ON "commercial"."supplier_contract_versions"("request_id", "version");

-- CreateIndex
CREATE INDEX "supplier_creative_tasks_event_id_idx" ON "commercial"."supplier_creative_tasks"("event_id");

-- CreateIndex
CREATE INDEX "supplier_creative_tasks_supplier_id_idx" ON "commercial"."supplier_creative_tasks"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_creative_tasks_request_status_due_idx" ON "commercial"."supplier_creative_tasks"("request_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "supplier_creative_submissions_object_id_idx" ON "commercial"."supplier_creative_submissions"("stored_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_creative_submissions_task_version_key" ON "commercial"."supplier_creative_submissions"("task_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payable_milestones_idempotency_key" ON "commercial"."supplier_payable_milestones"("idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_payable_milestones_event_id_idx" ON "commercial"."supplier_payable_milestones"("event_id");

-- CreateIndex
CREATE INDEX "supplier_payable_milestones_request_id_idx" ON "commercial"."supplier_payable_milestones"("request_id");

-- CreateIndex
CREATE INDEX "supplier_payable_milestones_quote_id_idx" ON "commercial"."supplier_payable_milestones"("quote_id");

-- CreateIndex
CREATE INDEX "supplier_payable_milestones_supplier_event_status_idx" ON "commercial"."supplier_payable_milestones"("supplier_id", "event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payout_records_idempotency_key" ON "commercial"."supplier_payout_records"("idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_payout_records_event_id_idx" ON "commercial"."supplier_payout_records"("event_id");

-- CreateIndex
CREATE INDEX "supplier_payout_records_milestone_date_idx" ON "commercial"."supplier_payout_records"("milestone_id", "payment_date");

-- CreateIndex
CREATE INDEX "supplier_payout_records_request_id_idx" ON "commercial"."supplier_payout_records"("request_id");

-- CreateIndex
CREATE INDEX "supplier_payout_records_quote_id_idx" ON "commercial"."supplier_payout_records"("quote_id");

-- CreateIndex
CREATE INDEX "supplier_payout_records_supplier_event_date_idx" ON "commercial"."supplier_payout_records"("supplier_id", "event_id", "payment_date");

-- CreateIndex
CREATE INDEX "supplier_payout_records_reverses_record_id_idx" ON "commercial"."supplier_payout_records"("reverses_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_review_items_idempotency_key" ON "commercial"."client_review_items"("idempotency_key");

-- CreateIndex
CREATE INDEX "client_review_items_event_kind_status_idx" ON "commercial"."client_review_items"("event_id", "kind", "status");

-- CreateIndex
CREATE INDEX "client_review_items_document_id_idx" ON "commercial"."client_review_items"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_review_items_event_kind_version_key" ON "commercial"."client_review_items"("event_id", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "client_review_decisions_idempotency_key" ON "commercial"."client_review_decisions"("idempotency_key");

-- CreateIndex
CREATE INDEX "client_review_decisions_event_id_idx" ON "commercial"."client_review_decisions"("event_id");

-- CreateIndex
CREATE INDEX "client_review_decisions_actor_id_idx" ON "commercial"."client_review_decisions"("actor_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_review_decisions_item_version_actor_key" ON "commercial"."client_review_decisions"("item_id", "item_version", "actor_id");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "commercial"."supplier_contract_versions" ADD CONSTRAINT "supplier_contract_versions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "commercial"."quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_contract_versions" ADD CONSTRAINT "supplier_contract_versions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "commercial"."supplier_creative_tasks" ADD CONSTRAINT "supplier_creative_tasks_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "commercial"."quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_creative_tasks" ADD CONSTRAINT "supplier_creative_tasks_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_creative_submissions" ADD CONSTRAINT "supplier_creative_submissions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "commercial"."supplier_creative_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payable_milestones" ADD CONSTRAINT "supplier_payable_milestones_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "commercial"."quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payable_milestones" ADD CONSTRAINT "supplier_payable_milestones_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "commercial"."quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payable_milestones" ADD CONSTRAINT "supplier_payable_milestones_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payout_records" ADD CONSTRAINT "supplier_payout_records_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "commercial"."supplier_payable_milestones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payout_records" ADD CONSTRAINT "supplier_payout_records_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "commercial"."quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payout_records" ADD CONSTRAINT "supplier_payout_records_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "commercial"."quotes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payout_records" ADD CONSTRAINT "supplier_payout_records_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_payout_records" ADD CONSTRAINT "supplier_payout_records_reverses_record_id_fkey" FOREIGN KEY ("reverses_record_id") REFERENCES "commercial"."supplier_payout_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "commercial"."client_review_decisions" ADD CONSTRAINT "client_review_decisions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "commercial"."client_review_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial"."supplier_contract_versions" ADD CONSTRAINT "supplier_contract_versions_content_check" CHECK ("version" > 0 AND "size_bytes" > 0 AND "checksum_sha256" ~ '^[a-fA-F0-9]{64}$');

ALTER TABLE "commercial"."supplier_creative_submissions" ADD CONSTRAINT "supplier_creative_submissions_version_check" CHECK ("version" > 0);

ALTER TABLE "commercial"."supplier_payable_milestones" ADD CONSTRAINT "supplier_payable_milestones_amount_check" CHECK ("amount" > 0);

ALTER TABLE "commercial"."supplier_payout_records" ADD CONSTRAINT "supplier_payout_records_amount_kind_check" CHECK ("amount" > 0 AND "kind" IN ('release', 'reversal'));

ALTER TABLE "commercial"."client_review_items" ADD CONSTRAINT "client_review_items_kind_version_check" CHECK ("kind" IN ('venue', 'styling') AND "version" > 0);

ALTER TABLE "commercial"."client_review_decisions" ADD CONSTRAINT "client_review_decisions_action_check" CHECK ("item_version" > 0 AND "action" IN ('approve', 'request_revision'));
