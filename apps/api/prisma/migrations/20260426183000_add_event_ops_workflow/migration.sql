CREATE TABLE IF NOT EXISTS "ops_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "approval_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_approval_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_inquiries" (
    "id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "client_type" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_inquiries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_events" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "client_portal_status" TEXT NOT NULL DEFAULT 'locked',
    "readiness" TEXT NOT NULL DEFAULT 'Conforme pending',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "floor_plan_status" TEXT NOT NULL DEFAULT 'not_started',
    "floor_plan_id" TEXT,
    "floor_plan_submitted_at" TIMESTAMP(3),
    "floor_plan_reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_documents" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "mime_type" TEXT,
    "size_bytes" INTEGER,
    "storage_bucket" TEXT,
    "storage_key" TEXT,
    "uploaded_by_role" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_briefings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "guest_count" INTEGER NOT NULL,
    "budget_range" TEXT NOT NULL,
    "service_requirements" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_briefings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_supplier_quote_requests" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "due_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_supplier_quote_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_supplier_quotes" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "request_id" TEXT,
    "supplier_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_supplier_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_coordinator_assignments" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "coordinator_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_acknowledgement',
    "double_booking_warning" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_coordinator_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_compliance_checks" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_compliance_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_billing_statements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_billing_statements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_payment_milestones" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_payment_milestones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_post_event_documents" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "ops_post_event_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_audit_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ops_notification_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'logged_mock',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_notification_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ops_users_email_key" ON "ops_users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "ops_billing_statements_number_key" ON "ops_billing_statements"("number");
CREATE INDEX IF NOT EXISTS "ops_approval_requests_status_requested_at_idx" ON "ops_approval_requests"("status", "requested_at");
CREATE INDEX IF NOT EXISTS "ops_inquiries_status_created_at_idx" ON "ops_inquiries"("status", "created_at");
CREATE INDEX IF NOT EXISTS "ops_events_status_event_date_idx" ON "ops_events"("status", "event_date");
CREATE INDEX IF NOT EXISTS "ops_documents_event_id_type_idx" ON "ops_documents"("event_id", "type");
CREATE INDEX IF NOT EXISTS "ops_briefings_event_id_submitted_at_idx" ON "ops_briefings"("event_id", "submitted_at");
CREATE INDEX IF NOT EXISTS "ops_supplier_quote_requests_event_id_status_idx" ON "ops_supplier_quote_requests"("event_id", "status");
CREATE INDEX IF NOT EXISTS "ops_supplier_quotes_event_id_status_idx" ON "ops_supplier_quotes"("event_id", "status");
CREATE INDEX IF NOT EXISTS "ops_coordinator_assignments_event_id_status_idx" ON "ops_coordinator_assignments"("event_id", "status");
CREATE INDEX IF NOT EXISTS "ops_compliance_checks_event_id_status_idx" ON "ops_compliance_checks"("event_id", "status");
CREATE INDEX IF NOT EXISTS "ops_billing_statements_event_id_generated_at_idx" ON "ops_billing_statements"("event_id", "generated_at");
CREATE INDEX IF NOT EXISTS "ops_payment_milestones_event_id_status_idx" ON "ops_payment_milestones"("event_id", "status");
CREATE INDEX IF NOT EXISTS "ops_post_event_documents_event_id_status_idx" ON "ops_post_event_documents"("event_id", "status");
CREATE INDEX IF NOT EXISTS "ops_audit_logs_event_id_created_at_idx" ON "ops_audit_logs"("event_id", "created_at");
CREATE INDEX IF NOT EXISTS "ops_notification_logs_event_id_created_at_idx" ON "ops_notification_logs"("event_id", "created_at");

ALTER TABLE "ops_events" ADD CONSTRAINT "ops_events_inquiry_id_fkey"
FOREIGN KEY ("inquiry_id") REFERENCES "ops_inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_documents" ADD CONSTRAINT "ops_documents_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_briefings" ADD CONSTRAINT "ops_briefings_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_supplier_quote_requests" ADD CONSTRAINT "ops_supplier_quote_requests_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_supplier_quotes" ADD CONSTRAINT "ops_supplier_quotes_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_coordinator_assignments" ADD CONSTRAINT "ops_coordinator_assignments_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_compliance_checks" ADD CONSTRAINT "ops_compliance_checks_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_billing_statements" ADD CONSTRAINT "ops_billing_statements_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_payment_milestones" ADD CONSTRAINT "ops_payment_milestones_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_post_event_documents" ADD CONSTRAINT "ops_post_event_documents_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_audit_logs" ADD CONSTRAINT "ops_audit_logs_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ops_notification_logs" ADD CONSTRAINT "ops_notification_logs_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "ops_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
