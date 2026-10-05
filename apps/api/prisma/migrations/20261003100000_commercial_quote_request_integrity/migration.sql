-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium

CREATE INDEX CONCURRENTLY "quotes_request_id_idx"
  ON "supplier_ops"."quotes"("request_id");

ALTER TABLE "supplier_ops"."quotes"
  ADD CONSTRAINT "quotes_request_id_fkey"
  FOREIGN KEY ("request_id")
  REFERENCES "supplier_ops"."quote_requests"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE
  NOT VALID;

ALTER TABLE "supplier_ops"."quotes"
  VALIDATE CONSTRAINT "quotes_request_id_fkey";