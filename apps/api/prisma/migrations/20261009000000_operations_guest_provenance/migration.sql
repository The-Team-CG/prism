-- prism-owner: operations
-- prism-kind: mixed
-- prism-risk: high

-- Guest provenance stays inside the Operations schema: a roster entry names the import batch it came from, and a
-- check-in names the roster entry it checked in, and in both cases the child must belong to the same event as the
-- parent. Roster entries, imports and check-ins are guest evidence and are never deleted here.
--
-- A link that cannot be trusted (parent missing, or parent belongs to a different event) is cleared to NULL so the
-- row itself is kept; the provenance, not the evidence, is what is lost.

CREATE UNIQUE INDEX "guest_roster_imports_id_event_id_key" ON "operations"."guest_roster_imports" ("id", "event_id");
CREATE UNIQUE INDEX "guest_roster_entries_id_event_id_key" ON "operations"."guest_roster_entries" ("id", "event_id");

UPDATE "operations"."guest_roster_entries"
SET "import_batch_id" = NULL
WHERE "import_batch_id" IS NOT NULL
  AND ("import_batch_id", "event_id") NOT IN (SELECT "id", "event_id" FROM "operations"."guest_roster_imports");

UPDATE "operations"."check_ins"
SET "roster_entry_id" = NULL
WHERE "roster_entry_id" IS NOT NULL
  AND ("roster_entry_id", "event_id") NOT IN (SELECT "id", "event_id" FROM "operations"."guest_roster_entries");

ALTER TABLE "operations"."guest_roster_entries"
  ADD CONSTRAINT "guest_roster_entries_import_event_fkey"
  FOREIGN KEY ("import_batch_id", "event_id") REFERENCES "operations"."guest_roster_imports" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "operations"."guest_roster_entries" VALIDATE CONSTRAINT "guest_roster_entries_import_event_fkey";

-- A check-in used to set its roster link to NULL when the entry was deleted; entries are only ever withdrawn, so the
-- link now restricts deletion instead of silently orphaning check-in evidence.
ALTER TABLE "operations"."check_ins" DROP CONSTRAINT "check_ins_roster_entry_id_fkey";
ALTER TABLE "operations"."check_ins"
  ADD CONSTRAINT "check_ins_roster_entry_event_fkey"
  FOREIGN KEY ("roster_entry_id", "event_id") REFERENCES "operations"."guest_roster_entries" ("id", "event_id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "operations"."check_ins" VALIDATE CONSTRAINT "check_ins_roster_entry_event_fkey";
