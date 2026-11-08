-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-77: contract versions record the stated contract total and the selected quote amount it was compared with.
-- Earlier versions carry neither and are not flagged.
ALTER TABLE "commercial"."supplier_contract_versions" ADD COLUMN "contract_total" INTEGER,
ADD COLUMN "quoted_total" INTEGER;
