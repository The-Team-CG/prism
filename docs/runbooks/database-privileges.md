---
type: "Playbook"
title: "Prism database roles and audit privileges"
description: "Which database roles may write which Prism schemas, how audit evidence stays append-only, and how to verify the real grants."
tags: [runbook, platform-ops, database, privileges, audit]
status: canonical
updated: "2026-10-29"
authority: operational
audience: [developers, reviewers, operators, agents]
scope: "PostgreSQL role and privilege model for the eight Prism owner schemas and the platform_ops audit tables"
last_verified: "2026-10-29; schema list and migrations reviewed (no audit hash-format constraint or grant statement is checked in); no live database inspected"
sources:
  - id: audit-schema
    resource: "apps/api/prisma/schema.prisma"
    title: "Platform audit persistence model"
  - id: audit-migration
    resource: "apps/api/prisma/migrations/20261006120006_platform-ops_schema_baseline/migration.sql"
    title: "Platform-ops audit tables baseline"
  - id: repair-runbook
    resource: "docs/runbooks/audit-chain-repair.md"
    title: "Audit-chain repair"
---
# Prism database roles and audit privileges

## At a glance

- **Purpose:** State the intended database privileges and give the queries that
  prove what a live database actually grants.
- **Rule:** The eight owner schemas are an ownership and review boundary, not a
  security boundary. One Prisma client and one runtime role write every schema.
  Do not claim schema-level isolation, and do not rely on RLS for this internal
  system.
- **Evidence status:** The statements below are the intended model. Migrations
  contain no grant statements, so record the output of the
  verification queries before relying on it.

## Roles

| Role | Used by | Intended privileges |
| --- | --- | --- |
| Migration role | `prisma migrate deploy` through the migration connection (`DIRECT_URL` when set, otherwise `DATABASE_URL`) | Owns the schemas and tables; creates and alters objects. Never used by the running API. |
| Runtime role | The API process | `USAGE` on each schema; `SELECT`, `INSERT`, `UPDATE`, `DELETE` on business tables; **only `SELECT` and `INSERT` on `platform_ops.audit_logs`**; `SELECT` and `UPDATE` on `platform_ops.audit_chain_locks`. |
| Maintenance role | The guarded audit-chain repair, run by an operator | Temporary `UPDATE` on `platform_ops.audit_logs` for the repair window only, then revoked. |

With the default single `DATABASE_URL`, the API and Prisma connect as one role.
Separating the migration role requires a `DIRECT_URL` that authenticates as it.

## Audit evidence

- Audit rows are appended through the platform audit writer, which takes the
  chain lock row, links `previous_hash` to the head, and writes the new row in
  one transaction. The runtime role therefore needs no `UPDATE` or `DELETE` on
  `audit_logs`.
- `audit_logs.event_id` is a scalar reference. The baselines create no FK to
  the event; a database that still carries the retired ledger may retain its
  legacy constraint until its separately approved rebuild.
  Archiving does not remove audit rows. Physical event deletion remains unsupported.
- The audit writer stores lower-case SHA-256 digests. No database constraint
  enforces the hash format in the current migrations; malformed hashes are
  detected by chain verification and refused by the audit-chain repair.
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
                    'floorplan', 'identity_access', 'platform_ops', 'event_games');
```

Expected: `prism_runtime` appears with `SELECT` and `INSERT` only on
`audit_logs`, and `runtime_can_create` is false for every schema. Anything else
is a finding to resolve before claiming append-only audit evidence.
