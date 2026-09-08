ALTER TABLE "compliance_ops"."post_event_documents"
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "client_acknowledged_at" TIMESTAMP(3),
  ADD COLUMN "client_acknowledged_by" TEXT,
  ADD COLUMN "client_acknowledgement_note" TEXT NOT NULL DEFAULT '';

ALTER TABLE "compliance_ops"."event_insights"
  ADD COLUMN "dimensions" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "compliance_ops"."event_wrap_ups" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'full',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "activated_at" TIMESTAMP(3) NOT NULL,
  "deadline_at" TIMESTAMP(3) NOT NULL,
  "twelve_hour_reminder_at" TIMESTAMP(3),
  "twenty_four_hour_reminder_at" TIMESTAMP(3),
  "required_items" JSONB NOT NULL DEFAULT '{}',
  "sections" JSONB NOT NULL DEFAULT '{}',
  "client_acknowledged_at" TIMESTAMP(3),
  "client_acknowledged_by" TEXT,
  "client_acknowledgement_note" TEXT NOT NULL DEFAULT '',
  "completed_at" TIMESTAMP(3),
  "completed_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "event_wrap_ups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_wrap_ups_event_id_key" ON "compliance_ops"."event_wrap_ups"("event_id");
CREATE INDEX "event_wrap_ups_deadline_status_idx" ON "compliance_ops"."event_wrap_ups"("deadline_at", "status");

ALTER TABLE "compliance_ops"."event_wrap_ups"
  ADD CONSTRAINT "event_wrap_ups_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
