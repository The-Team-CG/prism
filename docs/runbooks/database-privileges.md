---
type: "Playbook"
title: "Prism database roles and audit privileges"
description: "Which database roles may write which Prism schemas, how audit evidence stays append-only, and how to verify the real grants."
tags: [runbook, platform-ops, database, privileges, audit]
status: canonical
updated: "2026-10-06"
authority: operational
owner: "D (Anthony)"
audience: [developers, reviewers, operators, agents]
scope: "PostgreSQL role and privilege model for the seven Prism schemas and the platform_ops audit tables"
last_verified: "codex/pr30-audit-retention-privileges; role statements and verification queries reviewed, no live database inspected"
sources:
  - id: audit-schema
    resource: "apps/api/prisma/schema.prisma"
    title: "Platform audit persistence model"
  - id: audit-migration
    resource: "apps/api/prisma/migrations/20261010100000_platform-ops_audit_hash_shape/migration.sql"
    title: "Audit hash-shape constraints"
  - id: repair-runbook
    resource: "docs/runbooks/audit-chain-repair.md"
    title: "Audit-chain repair"
---
# Prism database roles and audit privileges

## At a glance

- **Purpose:** State the intended database privileges and give the queries that
  prove what a live database actually grants.
- **Rule:** The seven schemas are an ownership and review boundary, not a
  security boundary. One Prisma client and one runtime role write every schema.
  Do not claim schema-level isolation, and do not rely on RLS for this internal
  system.
- **Evidence status:** The statements below are the intended model. No live
  database was inspected when this was written; record the output of the
  verification queries before relying on it.

## Roles

| Role | Used by | Intended privileges |
| --- | --- | --- |
| Migration role | `prisma migrate deploy` through `DIRECT_URL` | Owns the schemas and tables; creates and alters objects. Never used by the running API. |
| Runtime role | The API process | `USAGE` on each schema; `SELECT`, `INSERT`, `UPDATE`, `DELETE` on business tables; **only `SELECT` and `INSERT` on `platform_ops.audit_logs`**; `SELECT` and `UPDATE` on `platform_ops.audit_chain_locks`. |
| Maintenance role | The guarded audit-chain repair, run by an operator | Temporary `UPDATE` on `platform_ops.audit_logs` for the repair window only, then revoked. |

## Audit evidence

- Audit rows are appended through the platform audit writer, which takes the
  chain lock row, links `previous_hash` to the head, and writes the new row in
  one transaction. The runtime role therefore needs no `UPDATE` or `DELETE` on
  `audit_logs`.
- `audit_logs.event_id` is a scalar reference in the current Prisma target. The
  replacement baselines create no FK to the event; an existing staging database
  may retain its legacy constraint until its separately approved rebuild.
  Archiving does not remove audit rows. Physical event deletion remains unsupported.
- New rows must carry lower-case SHA-256 digests. Constraints on
  `audit_logs` and `audit_chain_locks` reject anything else for every writer.
  They are `NOT VALID`, so historical rows are untouched and are handled by the
  audit-chain repair, not by the migration.
- Privacy redaction changes only the data-subject surfaces owned by each
  context. It never rewrites audit rows; a repair is the only operation that may
  rewrite hashes, and it is gated by backup and owner approval.

## Applying the model

Run as the migration role, replacing the role names with the real ones:

```sql
REVOKE UPDATE, DELETE, TRUNCATE ON platform_ops.audit_logs FROM prism_runtime;
GRANT SELECT, INSERT ON platform_ops.audit_logs TO prism_runtime;
GRANT SELECT, UPDATE ON platform_ops.audit_chain_locks TO prism_runtime;
```

For a repair window, grant `UPDATE` on `audit_logs` to the maintenance role,
run the repair, then revoke it. Do this only on a preproduction database that
has a verified backup.

## Verifying what is actually granted

```sql
-- Who can change audit evidence?
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'platform_ops' AND table_name = 'audit_logs'
ORDER BY grantee, privilege_type;

-- Who owns each Prism schema, and which roles can create objects in it?
SELECT n.nspname, pg_get_userbyid(n.nspowner) AS owner,
       has_schema_privilege('prism_runtime', n.nspname, 'CREATE') AS runtime_can_create
FROM pg_namespace n
WHERE n.nspname IN ('event_lifecycle', 'commercial', 'operations', 'live_ops',
                    'floorplan', 'identity_access', 'platform_ops');
```

Expected: `prism_runtime` appears with `SELECT` and `INSERT` only on
`audit_logs`, and `runtime_can_create` is false for every schema. Anything else
is a finding to resolve before claiming append-only audit evidence.
