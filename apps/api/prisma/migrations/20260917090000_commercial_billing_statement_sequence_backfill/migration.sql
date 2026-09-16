-- prism-owner: commercial
-- prism-kind: data
-- prism-risk: medium
INSERT INTO "finance_ops"."billing_statement_sequences" ("year", "next_number")
SELECT
  substring("number" FROM '^BS-([0-9]{4})-[0-9]{4}$')::integer,
  MAX(substring("number" FROM '^BS-[0-9]{4}-([0-9]{4})$')::integer) + 1
FROM "finance_ops"."billing_statements"
LEFT JOIN "finance_ops"."billing_statement_sequences"
  ON "year" = substring("number" FROM '^BS-([0-9]{4})-[0-9]{4}$')::integer
WHERE "number" ~ '^BS-[0-9]{4}-[0-9]{4}$'
  AND "year" IS NULL
GROUP BY substring("number" FROM '^BS-([0-9]{4})-[0-9]{4}$')::integer;
