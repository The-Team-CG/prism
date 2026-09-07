CREATE TABLE "guest_ops"."guest_roster_entries" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "guest_name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "eligibility" TEXT NOT NULL DEFAULT 'eligible',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "import_batch_id" TEXT,
  "checked_in_at" TIMESTAMP(3),
  "withdrawn_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "guest_roster_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "guest_roster_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "guest_roster_event_source_key" ON "guest_ops"."guest_roster_entries"("event_id", "source_key");
CREATE INDEX "guest_roster_event_name_idx" ON "guest_ops"."guest_roster_entries"("event_id", "normalized_name");
CREATE INDEX "guest_roster_event_eligibility_idx" ON "guest_ops"."guest_roster_entries"("event_id", "eligibility");
