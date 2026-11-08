-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- New-P4: courier bookings for returning client assets.
CREATE TABLE "commercial"."logistics_bookings" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "booking_reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "billing_source_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logistics_bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "logistics_bookings_event_created_idx" ON "commercial"."logistics_bookings"("event_id", "created_at");
