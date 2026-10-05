---
type: "Playbook"
title: "Prism database migrations"
description: "Create, review, deploy, and recover Prism's Prisma migrations without changing the applied history by hand."
tags: [runbook, database, migrations, prisma, drift, recovery]
status: canonical
updated: "2026-10-03"
authority: operational
owner: "D (Anthony)"
audience: [developers, reviewers, QA, operators, agents]
scope: "apps/api Prisma migration creation, static review, deployment, and drift recovery"
last_verified: "codex/db-integrity-ci; PostgreSQL workflow source reviewed"
sources:
  - id: migration-config
    resource: "apps/api/prisma.config.ts"
    title: "Prisma schema and migration path configuration"
  - id: migration-policy
    resource: "apps/api/prisma/migration-policy.json"
    title: "Migration ownership policy"
  - id: migration-guard
    resource: "apps/api/scripts/check-prisma-migrations.mjs"
    title: "Static migration guard"
  - id: persistence-register
    resource: "docs/architecture/persistence-ownership.md"
    title: "Persistence ownership register"
  - id: equivalence-gate
    resource: "apps/api/scripts/db-schema-equivalence.mjs"
    title: "Prisma and PostgreSQL catalog equivalence verifier"
  - id: replay-policy
    resource: "apps/api/prisma/migration-replay-policy.json"
    title: "PostgreSQL version and migration checkpoint policy"
  - id: replay-workflow
    resource: ".github/workflows/db-integrity.yml"
    title: "Disposable PostgreSQL migration replay workflow"
---
# Prism database migrations

## At a glance

- **Purpose:** Keep one trustworthy Prisma migration history while making new
  changes visibly owned, ordered, schema-scoped, and risk-reviewed.
- **Runtime source of truth:** `apps/api/prisma/migrations` and Prisma's
  `_prisma_migrations` ledger; the policy also records normalized SHA-256
  checksums for the immutable legacy SQL files.
- **Owner:** D (Anthony), with the owning bounded context responsible for its
  schema change and review evidence.
- **Verify with:** `npm run check:migrations`, `npm run check:invariants`,
  focused migration tests, Prisma validation, migration status, and a live
  diff when database access is intentionally available.
- **Important boundary:** This runbook does not authorize a reset, baseline,
  `migrate resolve`, or live schema repair.

## Runtime structure

Prism uses the standard Prisma layout:

```text
apps/api/prisma/
  schema.prisma
  migration-policy.json
  migrations/
    migration_lock.toml
    <version>_<owner>_<change_slug>/
      migration.sql
```

The current history is a flat set of timestamped Prisma directories. Do not
create `migrations/<owner>/...` folders: standard `prisma migrate dev` and
`prisma migrate deploy` discover direct migration directories, not an
AlphaCI-style recursive owner tree. The AlphaCI-style organization is applied
here through owner-aware names, machine-readable policy, static checks, and
this runbook while Prisma remains the execution engine.

Do not rename, move, rewrite, or regenerate an applied migration directory.
Prisma records its migration name and checksum in `_prisma_migrations`; a
historical correction belongs in a new forward migration or a reviewed
operator reconciliation, never in an edited old directory. The static guard
also compares the normalized legacy SQL checksums, so a same-name historical
edit fails CI before it can reach a database.

## Ownership and metadata

The owner-to-schema policy is in
[`apps/api/prisma/migration-policy.json`](../../apps/api/prisma/migration-policy.json)
and the domain explanation is in the
[persistence ownership register](../architecture/persistence-ownership.md).
The current policy buckets are `event-lifecycle`, `commercial`, `operations`,
`live-ops`, `floorplan`, `identity-access`, and `platform-ops`. `staffing_ops`
is intentionally shared by `operations` and `live-ops`; a physical schema is
not blanket permission to change another context's tables.

New migrations use a name such as:

```text
20260911123000_commercial_supplier_reconciliation
```

The top of its `migration.sql` declares:

```sql
-- prism-owner: commercial
-- prism-kind: schema
-- prism-risk: medium
```

`prism-kind` is `schema`, `data`, or `mixed`. The guard infers the kind from
DDL and data-write statements. `prism-risk` is `low`, `medium`, or `high`; a
declaration may be more conservative than the inference, never less.

The static risk rules treat these as high risk: dropping schemas, tables,
views, sequences, types, functions, columns, or constraints; truncation or
deletion; and type changes. Table changes, index creation/removal, schema
creation, inserts, and updates are at least medium.
The owning reviewer must still inspect locks, row counts, foreign keys, RLS,
backfill duration, and application compatibility; the static level is a gate,
not a deployment approval.

The shared `staffing_ops` schema has explicit table-owner mappings in the
policy. `operations` owns coordinator and coverage tables; `live-ops` owns
event-day task, schedule, handoff, issue, log, and reliability tables;
assignment and acknowledgement history remain explicit transitional exceptions.
New tables in `staffing_ops` need a policy mapping in the same reviewed change.
Other documented physical/logical mismatches, such as platform trust tables in
`identity`, are also explicit table exceptions rather than blanket schema
permission.

The guard fails closed for procedural or otherwise unsupported migration SQL,
including `DO` blocks, dynamic `EXECUTE`, stored function/procedure definitions,
`CALL`, `MERGE`, and `COPY`. Move that work behind a separately reviewed
mechanism or extend the checker and its tests before adding it to a migration.

## Create and review a migration

Run these commands from the repository root after confirming the owning context
and the intended physical schema:

```powershell
npm --workspace prism-api run db:migrate -- --name commercial_supplier_reconciliation
npm run check:migrations
npm --workspace prism-api run prisma:validate
npm --workspace prism-api run db:verify:offline
```

Then review the generated SQL and confirm:

1. The directory is a direct child of `apps/api/prisma/migrations`, its
   timestamp is a real calendar timestamp, and its version is later than the
   current baseline.
2. The owner in the directory name, SQL header, persistence register, and PR
   description agrees.
3. Every affected table/index/schema and relation reference is
   schema-qualified and belongs to an allowed owner schema. Shared schemas
   additionally require their explicit table-owner mapping. A deliberate
   cross-owner change requires an explicit ownership decision and policy update
   in the same review.
4. The declared kind and risk cover the SQL, with no unreviewed data write,
   destructive operation, type conversion, or long-running index/table lock.
5. No old migration directory was renamed or modified.

The root checker is also available through the API workspace as
`npm --workspace prism-api run db:check:migrations`. The focused tests run with
`npm run test:migrations`; neither command needs database credentials.

## Preflight and deploy

For a local or approved target, run the static and offline checks first:

```powershell
npm run check:migrations
npm run test:migrations
npm --workspace prism-api run prisma:validate
npm --workspace prism-api run db:verify:offline
```

For a configured database, inspect status before applying anything:

```powershell
npm --workspace prism-api run db:status
```

`db:status` runs the database doctor and Prisma migration status. Confirm the
target, direct migration connection, expected pending list, backup posture,
lock impact, and approval before deployment. Apply only the approved pending
history:

```powershell
npm --workspace prism-api run db:migrate:deploy
```

For the local bootstrap path, `npm --workspace prism-api run db:setup` runs the
doctor and deploy together. Migration connections should use the configured
direct URL rather than a transaction pooler when the environment requires it.
After deployment, rerun `db:status` and, when the target is approved for a
read-only comparison, run:

```powershell
npm --workspace prism-api run db:diff:live
```

`db:diff:live` is read-only. Exit `0` means no schema difference; exit `2`
means Prisma found a non-empty diff that needs review; exit `1` means the
comparison failed. A non-empty diff is evidence to investigate, not permission
to apply the generated SQL automatically.

## Data invariants

Schema changes and data backfills are not the only migration risks. Any
migration that introduces an invariant enforced by runtime code must add a
matching declaration to
[`apps/api/prisma/data-invariants.json`](../../apps/api/prisma/data-invariants.json).
Each declaration is a read-only violation query: zero rows means the invariant
holds, while returned rows must expose enough identifiers for an operator to
investigate the incompatible data. Keep the query schema-qualified and update
the declaration in the same reviewed change as the migration or backfill.

CI runs only the declaration dry-run and unit tests because it has no database
credentials. Before deployment, restore a representative database snapshot in
an isolated approved target and run the live, read-only gate with the direct
connection configured:

```powershell
npm --workspace prism-api run db:check:invariants
```

Review every reported violation, including the migration ledger status, before
deploying a migration that relies on the invariant. The gate never repairs,
backfills, or otherwise mutates data; remediation requires a separately
reviewed migration or operator procedure. Do not point the live command at a
production database from CI, and do not treat a dry-run pass as evidence that
the target data is compatible.

## Drift and failed-migration recovery

Stop normal deployment when the migration ledger, checked-in SQL, and live
database disagree. Classify the state before changing anything:

### Ledger drift

The database ledger may be missing a row for SQL whose effects are already
present, or may contain a failed/unresolved row. Inspect with `db:status` and
the database's migration metadata. Do not replay an already-applied migration
just because its ledger row is absent. `prisma migrate resolve` is an operator
command for a precisely verified ledger fact and requires an approved target,
exact migration-effect evidence, and an audit record.

### Live-schema drift

Use `db:diff:live` to produce a read-only comparison. Separate harmless
historical index/default differences from type changes, missing constraints,
or data-affecting operations. A missing object that belongs in the product
history normally receives a reviewed forward corrective migration. An object
that exists without a recorded creator requires provenance and ownership
review before it is adopted, dropped, or baselined.

Do not use a baseline to make a shared target look clean while hiding unknown
history. Do not apply a generated diff containing type changes, default drops,
index removal, foreign-key changes, or data operations without an explicit
review and backup decision.

### Failed migration rows

A failed migration can be transactional and leave no partial DDL, but that
must be verified for the actual target. Inspect the failed row, the transaction
result, and the live objects before retrying. If an object exists in the live
database but no migration created it, stop and reconcile the two histories;
do not keep retrying forward SQL or run a reset.

The normal recovery sequence is:

1. Stop the API/deploy worker that would issue more writes.
2. Capture target identity, migration status, failed row, and a read-only
   schema diff.
3. Protect the database with the environment's approved backup/restore
   procedure.
4. Decide whether the state is a verified ledger repair, a forward migration,
   or a separately approved baseline/rebuild.
5. Apply only the approved action, then rerun status, diff, and application
   acceptance checks.

`db:reset` is destructive and is not part of this procedure. The migration
guard itself performs no database mutation and cannot approve emergency repair.

## Required PostgreSQL replay and equivalence gate

The dedicated database integrity workflow at .github/workflows/db-integrity.yml
runs on pull requests and pushes targeting staging or prod. It provisions an
ephemeral PostgreSQL 16 service and invokes:

    npm --workspace prism-api run db:integrity:ci

The runner accepts only DB_INTEGRITY_ADMIN_URL resolving to
127.0.0.1:55437/postgres with DB_SSL=false. It checks the server major,
refuses to reuse any of its five fixed database names if they already exist,
and creates them without dropping or resetting databases. The service lifetime
provides cleanup in CI. For local rehearsal, use an isolated disposable
PostgreSQL service on that exact loopback endpoint; never point this command at
a shared or hosted database.

The gate uses separate databases for a clean full replay (prism_ci_fresh),
an upgrade from the recorded checkpoint (prism_ci_upgraded), and guarded
behavior tests (prism_p0). The upgrade checkpoint is
20260909100000_command_receipt_event_scope; the script applies that historical
prefix first and then the remaining checked-in migrations. The DB tests receive
only P0_TEST_DATABASE_URL=postgresql://...@127.0.0.1:55437/prism_p0. Their
machine-readable Vitest report must show every test passed with zero skipped
or pending tests.

For each schema verification, the script inventories SQL objects Prisma
cannot represent and requires an exact match to
apps/api/prisma/schema-sql-exceptions.json, including object definition,
owning domain, and rationale. It then runs
prisma migrate diff --from-config-datasource --to-schema ... --exit-code.
Ordinary tables, columns, constraints, defaults, and supported indexes must
match Prisma. A missing quote-request foreign key therefore fails as Prisma
drift; it is not added to the SQL-only exception list. The currently approved
SQL-only object list is empty. GIN, composite, and partial indexes are declared
in Prisma.

Two isolated negative cases verify that the gate itself fails closed: one
applies a temporary copy of the migration history with the quote-request FK
omitted, and one creates an unexpected expression index. Both are confined to
disposable databases and a temporary migration directory. The temporary
directory is removed only after its resolved path is verified to be under the
OS temp directory.

db:verify:schema runs the read-only catalog and Prisma comparison against
PRISMA_DATABASE_URL. It does not apply migrations or repair drift. It is
distinct from db:verify:offline, which validates a model and prints SQL from an
empty schema but does not compare the migration history to a live database.

The DB integration fixtures explicitly remove their own test records. The audit
chain test intentionally retains its append-only audit evidence in the
disposable database; deleting a tail could invalidate a concurrent writer.
No test teardown relies on deleting an event or account to cascade across
context-owned data.
## CI and evidence

Pull-request CI runs the static guard and focused tests without database
credentials. A migration PR should retain the command output for:

```text
npm run check:migrations
npm run test:migrations
npm --workspace prism-api run prisma:validate
```

If a live target was used, record the target identity, preflight status,
planned migration names, operator/approver, start/end time, result, post-deploy
status, and any remaining diff. Never commit database credentials or raw
secret-bearing output.
