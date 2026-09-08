CREATE TABLE "event_core"."inquiry_status_history" (
  "id" TEXT NOT NULL,
  "inquiry_id" TEXT NOT NULL,
  "event_id" TEXT,
  "from_status" TEXT,
  "to_status" TEXT NOT NULL,
  "transition" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_role" TEXT,
  "actor_name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_status_history_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inquiry_status_history_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "event_core"."inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "inquiry_status_history_inquiry_id_created_at_idx" ON "event_core"."inquiry_status_history" ("inquiry_id", "created_at");
CREATE INDEX "inquiry_status_history_event_id_created_at_idx" ON "event_core"."inquiry_status_history" ("event_id", "created_at");
