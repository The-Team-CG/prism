-- A row increment serializes appenders even when their transaction snapshot
-- predates a concurrent append. Historical audit hashes are left unchanged.
CREATE TABLE "trust_ops"."audit_chain_locks" (
  "id" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "audit_chain_locks_pkey" PRIMARY KEY ("id")
);
INSERT INTO "trust_ops"."audit_chain_locks" ("id", "revision") VALUES ('global', 0);
