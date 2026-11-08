-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-63: PMCM's recorded acceptance of a supplier gap (no available Tier 1 or Tier 2 supplier for a category).
CREATE TABLE "commercial"."supplier_gap_acknowledgements" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "acknowledged_by" TEXT NOT NULL,
    "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_gap_acknowledgements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_gap_acknowledgements_event_category_key" ON "commercial"."supplier_gap_acknowledgements"("event_id", "category_id");
