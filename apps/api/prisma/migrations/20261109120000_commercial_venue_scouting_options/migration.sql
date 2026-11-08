-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-10: venue options PMCM scouts for a client with no venue yet; the client marks one preference.
CREATE TABLE "commercial"."venue_scouting_options" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "price_range" TEXT NOT NULL,
    "available_dates" TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "client_preferred_at" TIMESTAMP(3),
    "client_preference_note" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "venue_scouting_options_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "venue_scouting_options_event_status_idx" ON "commercial"."venue_scouting_options"("event_id", "status");
