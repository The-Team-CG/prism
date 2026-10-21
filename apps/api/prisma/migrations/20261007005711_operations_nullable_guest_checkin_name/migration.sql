-- prism-owner: operations
-- prism-kind: schema
-- prism-risk: medium
ALTER TABLE "operations"."check_ins"
    ALTER COLUMN "guest_name" DROP NOT NULL;
