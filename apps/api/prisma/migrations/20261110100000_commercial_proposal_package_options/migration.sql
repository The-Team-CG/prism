-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

-- FR-62: a proposal may offer a second package (Option B). Existing proposals offer one.
ALTER TABLE "commercial"."proposal_versions"
    ADD COLUMN "alternative_cost_estimate_id" TEXT,
    ADD COLUMN "alternative_total_amount" INTEGER,
    ADD COLUMN "package_override_reason" TEXT;
