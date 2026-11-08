-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-65: suppliers the client books and coordinates outside P.R.I.S.M.
CREATE TABLE "commercial"."client_owned_suppliers" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "contact" TEXT NOT NULL DEFAULT '',
    "operational_notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmed_at" TIMESTAMP(3),
    "risk_warning" TEXT,
    "risk_raised_by" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_owned_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_owned_suppliers_event_status_idx" ON "commercial"."client_owned_suppliers"("event_id", "status");
