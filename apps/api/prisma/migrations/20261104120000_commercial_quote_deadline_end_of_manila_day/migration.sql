-- prism-owner: commercial
-- prism-kind: data
-- prism-risk: medium

-- Open quote requests stay open through the end of their Philippine calendar due date.
UPDATE "commercial"."quote_requests"
SET "due_date" = (
  ((("due_date" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Manila')::date + INTERVAL '1 day' - INTERVAL '1 millisecond')
  AT TIME ZONE 'Asia/Manila'
) AT TIME ZONE 'UTC'
WHERE "due_date" IS NOT NULL
  AND "status" IN ('open', 'revision_requested');
