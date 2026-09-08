-- W26: event freeze exceptions, immutable scanned addenda, and impact ledger.
ALTER TABLE "event_core"."events"
  ADD COLUMN "freeze_status" TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN "freeze_at" TIMESTAMP(3),
  ADD COLUMN "freeze_deadline_at" TIMESTAMP(3),
  ADD COLUMN "freeze_reason" TEXT NOT NULL DEFAULT '';

CREATE TABLE "event_core"."event_freeze_exceptions" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "requested_change" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "requested_by" TEXT NOT NULL,
  "decided_by" TEXT,
  "decision_note" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  CONSTRAINT "event_freeze_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_core"."addenda" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "version_number" INTEGER NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'issued',
  "document_id" TEXT,
  "document_state" TEXT NOT NULL DEFAULT 'pending',
  "signature_method" TEXT NOT NULL DEFAULT 'scanned_document',
  "contract_snapshot" JSONB NOT NULL,
  "quote_snapshot" JSONB NOT NULL,
  "comparison" JSONB NOT NULL DEFAULT '{}',
  "financial_delta" INTEGER NOT NULL DEFAULT 0,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "freeze_exception_id" TEXT,
  CONSTRAINT "addenda_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_core"."addendum_impacts" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "addendum_id" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "before_value" JSONB NOT NULL,
  "after_value" JSONB NOT NULL,
  "delta_amount" INTEGER NOT NULL DEFAULT 0,
  "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "addendum_impacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "addenda_event_version_key" ON "event_core"."addenda"("event_id", "version_number");
CREATE INDEX "event_freeze_exceptions_event_status_requested_idx" ON "event_core"."event_freeze_exceptions"("event_id", "status", "requested_at");
CREATE INDEX "addenda_event_issued_at_idx" ON "event_core"."addenda"("event_id", "issued_at");
CREATE INDEX "addendum_impacts_event_target_idx" ON "event_core"."addendum_impacts"("event_id", "target_type", "target_id");

ALTER TABLE "event_core"."event_freeze_exceptions"
  ADD CONSTRAINT "event_freeze_exceptions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_core"."addenda"
  ADD CONSTRAINT "addenda_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "addenda_freeze_exception_id_fkey" FOREIGN KEY ("freeze_exception_id") REFERENCES "event_core"."event_freeze_exceptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_core"."addendum_impacts"
  ADD CONSTRAINT "addendum_impacts_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "addendum_impacts_addendum_id_fkey" FOREIGN KEY ("addendum_id") REFERENCES "event_core"."addenda"("id") ON DELETE CASCADE ON UPDATE CASCADE;
