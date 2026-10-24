---
type: "Playbook"
title: "Prism database migrations"
description: "Create, review, deploy, and recover Prism's Prisma migrations without changing the applied history by hand."
tags: [runbook, database, migrations, prisma, drift, recovery]
status: canonical
updated: "2026-10-16"
authority: operational
owner: "D (Anthony)"
audience: [developers, reviewers, QA, operators, agents]
scope: "apps/api Prisma migration creation, static review, deployment, and drift recovery"
last_verified: "2026-10-06; seven baselines applied on disposable PostgreSQL 16; status and live schema diff clean"
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

- **Purpose:** Keep one clean Prisma migration history with a schema baseline for each bounded context and immutable forward changes.
- **Runtime source of truth:** `apps/api/prisma/migrations` and Prisma's `_prisma_migrations` ledger; the policy freezes checksums for the seven owner-scoped baselines.
- **Owner:** D (Anthony), with each bounded context responsible for its own schema changes and review evidence.
- **Verify with:** Prisma validation, a fresh PostgreSQL 16 replay, migration status, and live schema equivalence.
- **Important boundary:** The history replacement targets pre-production only. A database with the retired ledger needs a verified backup and an approved rebuild before the new history is applied.

## Local development target

The launchers start local Supabase, apply checked-in migrations, and require the
API ledger to match the checked-in head. DATABASE_URL is canonical; DIRECT_URL
is an optional migration override. Hosted connections retain verified TLS.

In a separate terminal, set PRISM_ENV_FILE to the absolute path of
.local-dev/api.env before running database commands. A replaced initial baseline
selects a separate local Supabase project and preserves the previous database
as a CLI backup. Appending migrations retains the same database. Startup never
resets or adopts an existing retired migration ledger.

## Runtime structure

Prism uses the standard Prisma layout:

    apps/api/prisma/
      schema.prisma
      migration-policy.json
      migrations/
        migration_lock.toml
        <version>_<owner>_<change_slug>/
          migration.sql

Migration directories are direct children. Do not create
`migrations/<owner>/...` folders: Prisma discovers direct migration
directories only. Owner-scoped folder names, SQL metadata, and the policy
preserve domain ownership while Prisma remains the execution engine.

The checked-in history now contains seven bootstrap migrations, one for each
write domain and schema. The old 102-folder pre-production history was removed
in a one-time rebaseline. The new baseline files are immutable once any
environment adopts them. Do not rename, move, rewrite, or regenerate them;
future changes use new forward migrations. Existing databases retain their old
`_prisma_migrations` rows until separately rebuilt.
## Ownership and metadata

The owner-to-schema policy is in
[`apps/api/prisma/migration-policy.json`](../../apps/api/prisma/migration-policy.json)
and the domain explanation is in the
[persistence ownership register](../architecture/persistence-ownership.md).
The seven owners each own one schema: event-lifecycle/event_lifecycle,
commercial/commercial, operations/operations, live-ops/live_ops,
floorplan/floorplan, identity-access/identity_access, and
platform-ops/platform_ops.

The initial migration sequence is:

    20261006120000_commercial_schema_baseline
    20261006120001_event-lifecycle_schema_baseline
    20261006120002_floorplan_schema_baseline
    20261006120003_identity-access_schema_baseline
    20261006120004_live-ops_schema_baseline
    20261006120005_operations_schema_baseline
    20261006120006_platform-ops_schema_baseline

Each baseline creates exactly its owner's schema objects and keeps only
same-domain foreign keys. Future migrations use a later timestamp and a
specific owner, for example
`20261007123000_commercial_supplier_reconciliation`. The top of its
`migration.sql` declares:

    -- prism-owner: commercial
    -- prism-kind: schema
    -- prism-risk: medium

`prism-kind` is `schema`, `data`, or `mixed`. The guard infers the kind from
DDL and data-write statements. `prism-risk` is `low`, `medium`, or `high`; a
declaration may be more conservative than the inference, never less.

The static risk rules treat drops, truncation, deletion, and type changes as
high risk. Table/schema changes, index changes, inserts, and updates are at
least medium. The owning reviewer must still inspect locks, row counts,
foreign keys, RLS, backfill duration, and application compatibility.

Portal migrations target the current owner schemas. References to another owner are scalar IDs validated by owner capabilities; they must not reintroduce cross-domain foreign keys into the clean baseline.

The guard rejects SQL it cannot safely classify, including `DO` blocks,
dynamic `EXECUTE`, stored function/procedure definitions, `CALL`, `MERGE`,
and `COPY`. Extend the checker and its tests before adding such SQL.
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
5. The seven baseline SQL files and checksums remain unchanged after adoption;
   future changes get new owner-scoped directories.

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

### Password hash rewrite (before the auth-hardening API)

The API now verifies only the current operator password hash format. Run this
one-off rewrite against the target database after its schema is deployed and
before the API that contains it starts serving sign-ins. It is idempotent, so a
second run skips rows that are already current:

```powershell
npm --workspace prism-api run db:migrate:password-hashes -- --dry-run
npm --workspace prism-api run db:migrate:password-hashes
```

The dry run prints counts only. The apply run refuses to write if any stored
value starts with `scrypt$` but matches neither format. Investigate such rows
before retrying. Deploying the API without this rewrite locks out operators
whose values are still legacy or plaintext.

## One-time pre-production baseline adoption

The seven migration files describe the final schema generated from
`apps/api/prisma/schema.prisma`. They replace the retired pre-production
history; they do not move data or reconcile the old migration ledger.

### Fresh disposable database

On an empty PostgreSQL 16 database, apply the full history and inspect the
migration status and live schema diff:

    npm --workspace prism-api run db:migrate:deploy
    npm --workspace prism-api run db:status
    npm --workspace prism-api run db:diff:live

Use an isolated disposable target. Do not point these commands at a shared or
hosted database.

### Existing staging database

Do not run the new history against a database whose ledger contains the retired
102 migration names. Do not use `migrate resolve --applied` alone: it does not
remove unknown rows or prove schema equivalence.

Before adopting the baseline, place staging writers and deploy jobs on hold,
take a backup, and verify a restore to another disposable database. Review
fixture and operator data with its owner. If the data is disposable, recreate
only the staging database using the approved provider procedure, deploy the
seven baselines, and check status, live diff, runtime compatibility, and
application acceptance before resuming writes.

If any data must be preserved, stop before recreating the database. This
baseline contains no data-copy or in-place schema-move migration. Recover the
retired history from the pre-rebaseline Git revision and plan a separate
owner-reviewed conversion and restore path. This rebaseline is not a
production migration.
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

For the approved domain-schema move rehearsal, safe disposable-target checks,
and row-preservation evidence, follow the
[domain schema cutover runbook](domain-schema-cutover.md). The manifest-driven
JSON export described there is an inspection aid, not a complete database
backup or recovery procedure.

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

## Migration review evidence

For a fresh baseline, retain the concise output for Prisma validation, migration
status, and a zero-diff schema comparison. Record which database was used;
local evidence does not qualify a different staging or production target.

Never commit database credentials or raw secret-bearing output.

## PR review

A migration change should identify the target database class, the migration
names, the pre-production adoption boundary, and the post-replay status.
Do not include credentials or raw secret-bearing output.
