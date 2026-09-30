-- Appends maintain a verified chain head under the existing singleton lock.
-- NULL values trigger one full verification/bootstrapping pass on first write.
ALTER TABLE "trust_ops"."audit_chain_locks"
  ADD COLUMN "head_id" TEXT,
  ADD COLUMN "head_hash" TEXT;

-- Let appenders cheaply detect audit rows written by older application instances
-- while the chain head is being introduced.
CREATE INDEX "audit_logs_created_at_idx" ON "trust_ops"."audit_logs"("created_at");
