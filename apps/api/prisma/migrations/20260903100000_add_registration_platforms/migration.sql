-- CreateTable
CREATE TABLE "guest_ops"."registration_platforms" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "platform_type" TEXT NOT NULL DEFAULT 'none',
    "supplier_id" TEXT,
    "expected_pax_min" INTEGER NOT NULL DEFAULT 0,
    "expected_pax_max" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "setup_confirmed_at" TIMESTAMPTZ,
    "setup_notes" TEXT NOT NULL DEFAULT '',
    "headcount_source" TEXT NOT NULL DEFAULT '',
    "imported_headcount" INTEGER NOT NULL DEFAULT 0,
    "imported_at" TIMESTAMPTZ,
    "imported_file_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_platforms_event_id_key" ON "guest_ops"."registration_platforms"("event_id");

-- CreateIndex
CREATE INDEX "registration_platforms_event_id_idx" ON "guest_ops"."registration_platforms"("event_id");

-- AddForeignKey
ALTER TABLE "guest_ops"."registration_platforms" ADD CONSTRAINT "registration_platforms_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
