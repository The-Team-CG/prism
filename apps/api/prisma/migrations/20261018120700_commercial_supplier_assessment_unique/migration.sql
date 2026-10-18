-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- CreateIndex
-- One PMCM assessment per supplier per event. Rows without an event (NULL) stay unconstrained.
-- Fails loudly if duplicate supplier/event assessments already exist; resolve them before deploying.
CREATE UNIQUE INDEX "supplier_reviews_supplier_event_key" ON "commercial"."supplier_reviews"("supplier_id", "event_id");
