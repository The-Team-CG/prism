---
type: "Playbook"
title: "Pre-production domain-schema baseline adoption"
description: "Safely replay the owner-scoped Prisma baseline and prepare a backed-up pre-production database rebuild."
tags: [runbook, database, ddd, migrations, recovery]
status: canonical
updated: "2026-10-06"
authority: operational
owner: "D (Anthony)"
audience: [developers, reviewers, QA, operators, agents]
scope: "Local disposable replay and approved pre-production adoption of the seven-schema Prisma baseline"
last_verified: "2026-10-06; seven baselines applied on disposable PostgreSQL 16; status and live schema diff clean"
sources:
  - id: schema
    resource: "apps/api/prisma/schema.prisma"
    title: "Current Prisma schema"
  - id: ownership
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Domain table ownership"
  - id: migration-policy
    resource: "apps/api/prisma/migration-policy.json"
    title: "Owner-scoped baseline names and checksums"
  - id: migration-runbook
    resource: "docs/runbooks/database-migrations.md"
    title: "Prisma migration operations"
---
# Pre-production domain-schema baseline adoption

## At a glance

- **Purpose:** Replay the final seven-domain schema from a clean database and safely prepare a pre-production database rebuild.
- **Authority:** Operational instructions; this document does not authorize a shared-database reset.
- **Owner:** D (Anthony).
- **Scope:** Seven schema baselines, disposable PostgreSQL replay, and legacy staging ledger handling.
- **Use when:** Reviewing or running the migration-history replacement.
- **Verify with:** A fresh-database replay, Prisma migration status, and live schema equivalence.

The repository replaces 102 pre-production migration folders with seven
owner-scoped schema baselines. Each baseline is generated from the current
Prisma schema and creates one owner schema. Together they create 94 business
tables, 1,191 columns, and 76 same-domain foreign keys across seven schemas;
they create no cross-domain foreign keys. Each file is wrapped in a PostgreSQL
transaction with bounded lock and statement timeouts.

The baseline represents the final schema on an empty database. It is not an
in-place upgrade from the retired migration ledger, and this change has not
modified staging or production databases.

## Run the local disposable replay

Use an isolated PostgreSQL 16 server bound to loopback port 55437. Do not point
these migration commands at a shared or hosted database.

    $env:PRISMA_DATABASE_URL = 'postgresql://postgres:<local-password>@127.0.0.1:55437/prism_migration_replay?schema=public'
    $env:DIRECT_URL = $env:PRISMA_DATABASE_URL
    $env:DATABASE_URL = $env:PRISMA_DATABASE_URL
    $env:SUPABASE_DB_URL = $env:PRISMA_DATABASE_URL
    $env:DB_SSL = 'false'
    npm --workspace prism-api run db:migrate:deploy
    npm --workspace prism-api run db:status
    npm --workspace prism-api run db:diff:live

Use a disposable PostgreSQL service with no persistent volume. The database must
be empty before applying this baseline. The live diff command is read-only.

## Existing pre-production database

The previous staging database may still contain the old schema and its
102-entry Prisma ledger. Do not run the new `migrate deploy` history against
that database. The old ledger entries are not in the new migration folders,
and `migrate resolve` alone would not prove the physical schema or remove the
unknown history.

Before adopting the new baseline in staging:

1. Put staging deployments and writers on hold.
2. Take a database backup and verify a restore to a separate disposable database.
3. Review any fixture or operator data with its owner and confirm whether it
   must be kept.
4. If the staging contents are disposable, recreate only the pre-production
   database through the approved provider procedure, then apply the seven
   baselines with `npm --workspace prism-api run db:migrate:deploy`.
5. Verify `db:status`, `db:diff:live`, the runtime schema compatibility head,
   and application acceptance before resuming deployments.

If any staging data must be preserved, stop before recreating the database.
This baseline contains no data-copy migration. Recover the retired history
from the pre-rebaseline Git revision and prepare a separate data-preserving
conversion with an owner-reviewed backup and restore plan. Production requires
its own migration plan; this pre-production history replacement is not a
production migration.

## Recovery

If the disposable replay or adoption checks fail, keep the deployment hold,
preserve the database and migration output, and restore the verified backup
when needed. Do not retry a failed baseline against a database with an
unknown ledger or partial schema. Classify and reconcile that database before
any further migration command.
