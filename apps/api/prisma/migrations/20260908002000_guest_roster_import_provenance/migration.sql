ALTER TABLE "guest_ops"."guest_roster_entries"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "table" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "verification_status" TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE "guest_ops"."guest_roster_imports" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "imported_by_id" TEXT,
  "imported_by" TEXT NOT NULL,
  "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "row_count" INTEGER NOT NULL,
  "raw_file_upload_blocked" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "guest_roster_imports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "guest_roster_imports_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "guest_roster_imports_event_imported_at_idx" ON "guest_ops"."guest_roster_imports"("event_id", "imported_at");

ALTER TABLE "guest_ops"."check_ins" ADD COLUMN "roster_entry_id" TEXT;
ALTER TABLE "guest_ops"."check_ins"
  ADD CONSTRAINT "check_ins_roster_entry_id_fkey" FOREIGN KEY ("roster_entry_id") REFERENCES "guest_ops"."guest_roster_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "check_ins_event_id_roster_entry_id_key" ON "guest_ops"."check_ins"("event_id", "roster_entry_id");
