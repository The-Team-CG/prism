CREATE TABLE "supplier_ops"."supplier_schedules" (
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
CREATE UNIQUE INDEX "supplier_schedules_request_id_key" ON "supplier_ops"."supplier_schedules"("request_id");
CREATE INDEX "supplier_schedules_event_id_ingress_at_idx" ON "supplier_ops"."supplier_schedules"("event_id", "ingress_at");
ALTER TABLE "supplier_ops"."supplier_schedules" ADD CONSTRAINT "supplier_schedules_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_core"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_ops"."supplier_schedules" ADD CONSTRAINT "supplier_schedules_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "supplier_ops"."quote_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
