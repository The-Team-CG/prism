-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- Deploy precondition: no two assessments may share (supplier_id, event_id).
-- The guard raises a named conflict and never deletes rows. It only errors when duplicates exist,
-- by casting the conflict list to an integer, so the failure message lists each duplicate pair.
SELECT CASE WHEN EXISTS (
  SELECT 1 FROM "commercial"."supplier_reviews"
  WHERE "event_id" IS NOT NULL
  GROUP BY "supplier_id", "event_id"
  HAVING COUNT(*) > 1
) THEN CAST(
  'supplier_reviews has duplicate (supplier_id, event_id) assessments that block supplier_reviews_supplier_event_key; resolve them manually, this migration deletes nothing: ' || (
    SELECT string_agg("supplier_id" || '/' || "event_id" || ' x' || copies::text, ', ')
    FROM (
      SELECT "supplier_id", "event_id", COUNT(*) AS copies
      FROM "commercial"."supplier_reviews"
      WHERE "event_id" IS NOT NULL
      GROUP BY "supplier_id", "event_id"
      HAVING COUNT(*) > 1
    ) AS dupe_pairs
  ) AS integer) END;

-- CreateIndex
-- One PMCM assessment per supplier per event. Rows without an event (NULL) stay unconstrained.
CREATE UNIQUE INDEX "supplier_reviews_supplier_event_key" ON "commercial"."supplier_reviews"("supplier_id", "event_id");
