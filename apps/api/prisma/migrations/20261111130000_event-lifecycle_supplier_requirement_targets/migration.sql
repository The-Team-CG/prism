-- prism-owner: event-lifecycle
-- prism-kind: schema
-- prism-risk: medium

ALTER TABLE "event_lifecycle"."file_requirements"
ADD COLUMN "target_supplier_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
