-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium
-- Owner-scoped baseline for the commercial schema.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "commercial";

-- CreateTable
CREATE TABLE "commercial"."cost_estimates" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "budget_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."cost_estimate_lines" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "source_line_id" TEXT,

    CONSTRAINT "cost_estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."proposal_versions" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "cost_estimate_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "total_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision_note" TEXT NOT NULL DEFAULT '',
    "issued_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."quote_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "category_id" TEXT,
    "supplier_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "due_date" TIMESTAMP(3),
    "access_token" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMPTZ(6),
    "access_token_revoked_at" TIMESTAMPTZ(6),
    "confidential_bid" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignment_status" TEXT NOT NULL DEFAULT 'pending_confirmation',
    "assignment_confirmed_at" TIMESTAMP(3),
    "readiness_status" TEXT NOT NULL DEFAULT 'not_requested',
    "readiness_confirmed_at" TIMESTAMP(3),
    "readiness_notes" TEXT NOT NULL DEFAULT '',
    "event_day_status" TEXT NOT NULL DEFAULT 'not_started',
    "event_day_status_at" TIMESTAMP(3),
    "event_day_notes" TEXT NOT NULL DEFAULT '',
    "event_day_verification_status" TEXT NOT NULL DEFAULT 'self_reported',
    "event_day_verified_at" TIMESTAMP(3),
    "event_day_verified_by" TEXT,
    "event_day_verification_notes" TEXT NOT NULL DEFAULT '',
    "status_photo_file_name" TEXT,
    "contract_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "round_id" TEXT,

    CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_schedules" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "ingress_at" TIMESTAMP(3) NOT NULL,
    "egress_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."quote_rounds" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "round_number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "quote_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."quotes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_id" TEXT,
    "supplier_id" TEXT,
    "category_id" TEXT,
    "supplier_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "inclusions" JSONB NOT NULL DEFAULT '[]',
    "payment_terms" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "acceptable_min" INTEGER,
    "acceptable_max" INTEGER,
    "outside_acceptable_range" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "revision_number" INTEGER NOT NULL DEFAULT 1,
    "revised_at" TIMESTAMP(3),
    "selected_at" TIMESTAMP(3),
    "locked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "acceptable_min" INTEGER,
    "acceptable_max" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."suppliers" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL DEFAULT 'pending_first_event',
    "bni_member" BOOLEAN NOT NULL DEFAULT false,
    "service_inclusions" TEXT NOT NULL DEFAULT '',
    "performance_notes" TEXT NOT NULL DEFAULT '',
    "application_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_availability" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "available_on" DATE NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_reviews" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "event_id" TEXT,
    "rating" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "reviewed_by" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_review_dimensions" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_review_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_review_dimension_ratings" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "dimension_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,

    CONSTRAINT "supplier_review_dimension_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_reliability_notes" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "event_id" TEXT,
    "note" TEXT NOT NULL,
    "created_by" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_reliability_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_certifications" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "document_type" TEXT NOT NULL DEFAULT '',
    "issuer" TEXT NOT NULL DEFAULT '',
    "expires_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "notes" TEXT NOT NULL DEFAULT '',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_applications" (
    "id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "category_id" TEXT,
    "past_events" TEXT NOT NULL DEFAULT '',
    "service_inclusions" TEXT NOT NULL DEFAULT '',
    "certifications" TEXT NOT NULL DEFAULT '',
    "price_range" TEXT NOT NULL DEFAULT '',
    "bni_member" BOOLEAN NOT NULL DEFAULT false,
    "portfolio_url" TEXT NOT NULL DEFAULT '',
    "additional_notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decline_reason" TEXT,
    "reviewed_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "converted_supplier_id" TEXT,
    "conversion_idempotency_key" TEXT,
    "conversion_payload_hash" TEXT,
    "privacy_consent_accepted" BOOLEAN NOT NULL DEFAULT false,
    "privacy_notice_version" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."supplier_promotions" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "from_tier" TEXT NOT NULL,
    "to_tier" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "promoted_by" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."billing_sources" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'ce_proposal',
    "source_label" TEXT NOT NULL,
    "source_document_id" TEXT,
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "payment_schedule" JSONB NOT NULL DEFAULT '[]',
    "payment_methods" JSONB NOT NULL DEFAULT '[]',
    "total_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "approval_notes" TEXT NOT NULL DEFAULT '',
    "payment_terms_policy_state" TEXT NOT NULL DEFAULT 'standard',
    "payment_terms_override_reason" TEXT,
    "payment_terms_approved_by" TEXT,
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."billing_statements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source_id" TEXT,
    "number" TEXT NOT NULL,
    "client_name" TEXT NOT NULL DEFAULT '',
    "client_contact" TEXT NOT NULL DEFAULT '',
    "event_name" TEXT NOT NULL DEFAULT '',
    "event_date" TIMESTAMP(3),
    "line_items" JSONB NOT NULL DEFAULT '[]',
    "payment_schedule" JSONB NOT NULL DEFAULT '[]',
    "payment_methods" JSONB NOT NULL DEFAULT '[]',
    "total_amount" INTEGER NOT NULL,
    "document_id" TEXT,
    "pdf_url" TEXT NOT NULL DEFAULT '',
    "storage_key" TEXT NOT NULL DEFAULT '',
    "storage_object_id" TEXT,
    "storage_state" TEXT NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "sent_at" TIMESTAMP(3),
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."billing_statement_sequences" (
    "year" INTEGER NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "billing_statement_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "commercial"."payment_milestones" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL DEFAULT 50,
    "amount" INTEGER NOT NULL,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "remaining_balance" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."payment_records" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "milestone_id" TEXT NOT NULL,
    "amount_received" INTEGER NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "payment_method" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL DEFAULT '',
    "idempotency_key" TEXT,
    "payload_hash" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."billing_corrections" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "corrected_total_amount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "resolved_by" TEXT,
    "resolution_notes" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "billing_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."billing_disputes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "milestone_id" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "raised_by" TEXT NOT NULL,
    "resolved_by" TEXT,
    "resolution_notes" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "billing_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."additional_billings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "urgent_issue_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "waiver_reason" TEXT,
    "waived_by" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waived_at" TIMESTAMP(3),

    CONSTRAINT "additional_billings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."communication_threads" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."communication_participants" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "actor_email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_read_at" TIMESTAMP(3),
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial"."communication_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_role" TEXT NOT NULL,
    "sender_email" TEXT,
    "body" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cost_estimates_event_id_created_at_idx" ON "commercial"."cost_estimates"("event_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "cost_estimates_id_event_id_key" ON "commercial"."cost_estimates"("id", "event_id");

-- CreateIndex
CREATE INDEX "cost_estimate_lines_estimate_id_category_idx" ON "commercial"."cost_estimate_lines"("estimate_id", "category");

-- CreateIndex
CREATE INDEX "proposal_versions_event_id_status_idx" ON "commercial"."proposal_versions"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_event_version_key" ON "commercial"."proposal_versions"("event_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_access_token_key" ON "commercial"."quote_requests"("access_token");

-- CreateIndex
CREATE INDEX "quote_requests_event_id_status_idx" ON "commercial"."quote_requests"("event_id", "status");

-- CreateIndex
CREATE INDEX "quote_requests_event_supplier_status_idx" ON "commercial"."quote_requests"("event_id", "supplier_id", "status");

-- CreateIndex
CREATE INDEX "quote_requests_supplier_id_idx" ON "commercial"."quote_requests"("supplier_id");

-- CreateIndex
CREATE INDEX "quote_requests_category_id_idx" ON "commercial"."quote_requests"("category_id");

-- CreateIndex
CREATE INDEX "quote_requests_contract_document_id_idx" ON "commercial"."quote_requests"("contract_document_id");

-- CreateIndex
CREATE INDEX "quote_requests_round_id_idx" ON "commercial"."quote_requests"("round_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_requests_id_event_id_key" ON "commercial"."quote_requests"("id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_schedules_request_id_key" ON "commercial"."supplier_schedules"("request_id");

-- CreateIndex
CREATE INDEX "supplier_schedules_event_id_ingress_at_idx" ON "commercial"."supplier_schedules"("event_id", "ingress_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_schedules_request_id_event_id_key" ON "commercial"."supplier_schedules"("request_id", "event_id");

-- CreateIndex
CREATE INDEX "supplier_quote_rounds_event_category_status_idx" ON "commercial"."quote_rounds"("event_id", "category_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_quote_rounds_event_category_number_key" ON "commercial"."quote_rounds"("event_id", "category_id", "round_number");

-- CreateIndex
CREATE INDEX "quotes_event_id_status_idx" ON "commercial"."quotes"("event_id", "status");

-- CreateIndex
CREATE INDEX "quotes_event_request_status_idx" ON "commercial"."quotes"("event_id", "request_id", "status");

-- CreateIndex
CREATE INDEX "quotes_supplier_id_idx" ON "commercial"."quotes"("supplier_id");

-- CreateIndex
CREATE INDEX "quotes_request_id_idx" ON "commercial"."quotes"("request_id");

-- CreateIndex
CREATE INDEX "quotes_category_id_idx" ON "commercial"."quotes"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_categories_slug_key" ON "commercial"."supplier_categories"("slug");

-- CreateIndex
CREATE INDEX "supplier_categories_active_sort_order_idx" ON "commercial"."supplier_categories"("active", "sort_order");

-- CreateIndex
CREATE INDEX "suppliers_category_id_tier_idx" ON "commercial"."suppliers"("category_id", "tier");

-- CreateIndex
CREATE INDEX "suppliers_bni_member_idx" ON "commercial"."suppliers"("bni_member");

-- CreateIndex
CREATE INDEX "supplier_availability_date_blocked_idx" ON "commercial"."supplier_availability"("available_on", "blocked");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_availability_supplier_date_key" ON "commercial"."supplier_availability"("supplier_id", "available_on");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_reviews_idempotency_key_key" ON "commercial"."supplier_reviews"("idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_reviews_supplier_id_created_at_idx" ON "commercial"."supplier_reviews"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "supplier_reviews_event_id_idx" ON "commercial"."supplier_reviews"("event_id");

-- CreateIndex
CREATE INDEX "supplier_review_dimensions_category_id_active_sort_order_idx" ON "commercial"."supplier_review_dimensions"("category_id", "active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_review_dimensions_category_id_slug_key" ON "commercial"."supplier_review_dimensions"("category_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_review_dimension_ratings_review_id_dimension_id_key" ON "commercial"."supplier_review_dimension_ratings"("review_id", "dimension_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_reliability_notes_idempotency_key_key" ON "commercial"."supplier_reliability_notes"("idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_reliability_notes_supplier_id_created_at_idx" ON "commercial"."supplier_reliability_notes"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "supplier_reliability_notes_event_id_idx" ON "commercial"."supplier_reliability_notes"("event_id");

-- CreateIndex
CREATE INDEX "supplier_certifications_supplier_id_uploaded_at_idx" ON "commercial"."supplier_certifications"("supplier_id", "uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_applications_converted_supplier_id_key" ON "commercial"."supplier_applications"("converted_supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_applications_conversion_idempotency_key_key" ON "commercial"."supplier_applications"("conversion_idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_applications_normalized_email_created_at_idx" ON "commercial"."supplier_applications"("normalized_email", "created_at");

-- CreateIndex
CREATE INDEX "supplier_applications_status_idx" ON "commercial"."supplier_applications"("status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_promotions_idempotency_key_key" ON "commercial"."supplier_promotions"("idempotency_key");

-- CreateIndex
CREATE INDEX "supplier_promotions_supplier_id_created_at_idx" ON "commercial"."supplier_promotions"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "supplier_promotions_review_id_idx" ON "commercial"."supplier_promotions"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_sources_idempotency_key_key" ON "commercial"."billing_sources"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_sources_event_id_status_idx" ON "commercial"."billing_sources"("event_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "billing_statements_number_key" ON "commercial"."billing_statements"("number");

-- CreateIndex
CREATE UNIQUE INDEX "billing_statements_idempotency_key_key" ON "commercial"."billing_statements"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_statements_event_id_generated_at_idx" ON "commercial"."billing_statements"("event_id", "generated_at");

-- CreateIndex
CREATE INDEX "billing_statements_source_id_idx" ON "commercial"."billing_statements"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_statements_id_event_id_key" ON "commercial"."billing_statements"("id", "event_id");

-- CreateIndex
CREATE INDEX "payment_milestones_event_id_status_idx" ON "commercial"."payment_milestones"("event_id", "status");

-- CreateIndex
CREATE INDEX "payment_milestones_event_due_date_idx" ON "commercial"."payment_milestones"("event_id", "due_date", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_milestones_id_event_id_key" ON "commercial"."payment_milestones"("id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_records_idempotency_key_key" ON "commercial"."payment_records"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_records_event_id_recorded_at_idx" ON "commercial"."payment_records"("event_id", "recorded_at");

-- CreateIndex
CREATE INDEX "payment_records_milestone_id_recorded_at_idx" ON "commercial"."payment_records"("milestone_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_corrections_idempotency_key_key" ON "commercial"."billing_corrections"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_corrections_event_id_status_idx" ON "commercial"."billing_corrections"("event_id", "status");

-- CreateIndex
CREATE INDEX "billing_corrections_statement_id_created_at_idx" ON "commercial"."billing_corrections"("statement_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "billing_disputes_idempotency_key_key" ON "commercial"."billing_disputes"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_disputes_event_id_status_idx" ON "commercial"."billing_disputes"("event_id", "status");

-- CreateIndex
CREATE INDEX "billing_disputes_statement_id_created_at_idx" ON "commercial"."billing_disputes"("statement_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "additional_billings_idempotency_key_key" ON "commercial"."additional_billings"("idempotency_key");

-- CreateIndex
CREATE INDEX "additional_billings_event_id_status_idx" ON "commercial"."additional_billings"("event_id", "status");

-- CreateIndex
CREATE INDEX "additional_billings_urgent_issue_id_idx" ON "commercial"."additional_billings"("urgent_issue_id");

-- CreateIndex
CREATE INDEX "communication_threads_event_id_updated_at_idx" ON "commercial"."communication_threads"("event_id", "updated_at");

-- CreateIndex
CREATE INDEX "communication_participants_actor_active_idx" ON "commercial"."communication_participants"("actor_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "communication_participants_thread_actor_key" ON "commercial"."communication_participants"("thread_id", "actor_id");

-- CreateIndex
CREATE INDEX "communication_messages_thread_id_created_at_idx" ON "commercial"."communication_messages"("thread_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "communication_messages_thread_id_idempotency_key_key" ON "commercial"."communication_messages"("thread_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "commercial"."cost_estimate_lines" ADD CONSTRAINT "cost_estimate_lines_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "commercial"."cost_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."proposal_versions" ADD CONSTRAINT "proposal_versions_cost_estimate_event_fkey" FOREIGN KEY ("cost_estimate_id", "event_id") REFERENCES "commercial"."cost_estimates"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."quote_requests" ADD CONSTRAINT "quote_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."quote_requests" ADD CONSTRAINT "quote_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commercial"."supplier_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."quote_requests" ADD CONSTRAINT "quote_requests_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "commercial"."quote_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_schedules" ADD CONSTRAINT "supplier_schedules_request_event_fkey" FOREIGN KEY ("request_id", "event_id") REFERENCES "commercial"."quote_requests"("id", "event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."quote_rounds" ADD CONSTRAINT "quote_rounds_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commercial"."supplier_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."quotes" ADD CONSTRAINT "quotes_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "commercial"."quote_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."quotes" ADD CONSTRAINT "quotes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."quotes" ADD CONSTRAINT "quotes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commercial"."supplier_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."suppliers" ADD CONSTRAINT "suppliers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commercial"."supplier_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_availability" ADD CONSTRAINT "supplier_availability_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_reviews" ADD CONSTRAINT "supplier_reviews_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_review_dimensions" ADD CONSTRAINT "supplier_review_dimensions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commercial"."supplier_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_review_dimension_ratings" ADD CONSTRAINT "supplier_review_dimension_ratings_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "commercial"."supplier_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_review_dimension_ratings" ADD CONSTRAINT "supplier_review_dimension_ratings_dimension_id_fkey" FOREIGN KEY ("dimension_id") REFERENCES "commercial"."supplier_review_dimensions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_reliability_notes" ADD CONSTRAINT "supplier_reliability_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_certifications" ADD CONSTRAINT "supplier_certifications_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_applications" ADD CONSTRAINT "supplier_applications_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "commercial"."supplier_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_applications" ADD CONSTRAINT "supplier_applications_converted_supplier_id_fkey" FOREIGN KEY ("converted_supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_promotions" ADD CONSTRAINT "supplier_promotions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "commercial"."suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."supplier_promotions" ADD CONSTRAINT "supplier_promotions_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "commercial"."supplier_reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."billing_statements" ADD CONSTRAINT "billing_statements_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "commercial"."billing_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."payment_records" ADD CONSTRAINT "payment_records_milestone_event_fkey" FOREIGN KEY ("milestone_id", "event_id") REFERENCES "commercial"."payment_milestones"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."billing_corrections" ADD CONSTRAINT "billing_corrections_statement_event_fkey" FOREIGN KEY ("statement_id", "event_id") REFERENCES "commercial"."billing_statements"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."billing_disputes" ADD CONSTRAINT "billing_disputes_statement_event_fkey" FOREIGN KEY ("statement_id", "event_id") REFERENCES "commercial"."billing_statements"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."billing_disputes" ADD CONSTRAINT "billing_disputes_milestone_event_fkey" FOREIGN KEY ("milestone_id", "event_id") REFERENCES "commercial"."payment_milestones"("id", "event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."communication_participants" ADD CONSTRAINT "communication_participants_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "commercial"."communication_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial"."communication_messages" ADD CONSTRAINT "communication_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "commercial"."communication_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
