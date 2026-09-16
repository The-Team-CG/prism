-- prism-owner: platform-ops
-- prism-kind: mixed
-- prism-risk: high
-- Repairs the audit hash chain and removes the defect that allowed it to break.
--
-- immutable_hash carried DEFAULT '' since 20260429003500, so any writer that
-- bypassed AuditService inserted a row with an empty hash and a NULL
-- previous_hash. Such a row is a second chain root that can never recompute,
-- which made every authenticated append fail closed once the chain check landed.
--
-- An empty immutable_hash is proof the row was never hash-linked, so deleting
-- on that predicate cannot remove a record that was ever part of the trail.
DELETE FROM "trust_ops"."audit_logs" WHERE "immutable_hash" = '';

-- Without the default, an unhashed audit row becomes impossible to insert
-- rather than merely unlikely.
ALTER TABLE "trust_ops"."audit_logs" ALTER COLUMN "immutable_hash" DROP DEFAULT;
