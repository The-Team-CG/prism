ALTER TABLE "event_core"."events" ADD COLUMN "walk_in_policy" TEXT NOT NULL DEFAULT 'closed';
ALTER TABLE "event_core"."events" ADD COLUMN "walk_in_threshold" INTEGER NOT NULL DEFAULT 200;
