---
type: "Playbook"
title: "Domain schema cutover rehearsal"
description: "Safely inspect disposable PostgreSQL copies before moving Prism tables to their owning domain schemas and removing cross-domain foreign keys."
tags: [runbook, database, ddd, preflight, recovery]
status: canonical
updated: "2026-10-06"
authority: operational
owner: "D (Anthony)"
audience: [developers, reviewers, QA, operators, agents]
scope: "Read-only DDD preflight and populated rehearsal for the Prism domain schema cutover"
last_verified: "2026-10-06; ownership manifest and migration map reviewed; populated disposable PostgreSQL replay verified with psql; Prisma migrate deploy not exercised"
sources:
  - id: persistence-register
    resource: "docs/architecture/persistence-ownership.md"
    title: "Persistence ownership register"
  - id: ownership-manifest
    resource: "apps/api/prisma/domain-ownership.json"
    title: "Database table ownership manifest"
  - id: migration-runbook
    resource: "docs/runbooks/database-migrations.md"
    title: "Prisma migration operations"
---
# Domain schema cutover rehearsal

## At a glance

- **Purpose:** Inspect a disposable PostgreSQL copy before and after the DDD schema move.
- **Authority:** Operational preflight and rehearsal guide; it does not authorize production migration.
- **Owner:** D (Anthony).
- **Scope:** Read-only checks, populated rehearsal, evidence retention, and recovery for the domain-schema cutover.
- **Use when:** Preparing or reviewing a disposable cutover rehearsal.
- **Change when:** The ownership manifest, preflight, backup, or cutover migrations change.
- **Verify with:** The referenced preflight and migration runbook; this documents psql replay evidence and states that Prisma migrate deploy remains unverified.

Use this runbook to inspect a disposable PostgreSQL copy before applying the
domain-schema cutover migration that moves tables to their owning schemas and
removes cross-domain foreign keys. The preflight is read-only. It does not
repair rows, apply migrations, or stop database sessions. The migration was
rehearsed with psql against a populated disposable copy; the Prisma migration
CLI path remains unverified and no staging or production database was changed.

## Target and report safety

The preflight reads only `PRISM_DDD_PREFLIGHT_DATABASE_URL`. It does not fall
back to `DATABASE_URL`, `DIRECT_URL`, or the API `.env` file. The URL must point
to loopback and a database named `prism_p0`, `prism_preflight_*`,
`prism_upgrade_*`, or `prism_restore_*`.

The required JSON artifact includes opaque row identifiers, catalog details,
migration names, payload checksums, and financial totals. Choose an existing
ACL-protected directory outside the repository. The script creates the file
with owner-only mode where the host filesystem supports POSIX modes, refuses
to overwrite an existing report, and prints aggregate counts only. Protect and
retain the artifact according to the database-data handling policy.

```powershell
$env:PRISM_DDD_PREFLIGHT_DATABASE_URL = '<loopback URL for prism_p0 or another approved disposable database>'
npm --workspace prism-api run db:preflight:ddd -- --artifact 'C:\private\prism-ddd-preflight.json'
```

Pass `--final` after the schema move rehearsal to check the target schema map
and require only same-domain foreign keys:

```powershell
npm --workspace prism-api run db:preflight:ddd -- --final --artifact 'C:\private\prism-ddd-preflight-final.json'
```

The current-mode check expects the current owner table locations and all
manifested foreign keys. Final mode expects each table in its owner schema,
no old-schema copy, and only same-domain foreign keys. Both modes check the
Prisma migration ledger and compare stored SQL checksums. Pending checked-in
migrations are reported for the planned upgrade; unknown migrations,
checksum differences, unresolved migration rows, catalog differences, or
blocking data findings stop the preflight.

`ready` means the catalog and blocking data checks match the selected mode.
`review-required` means recoverable expired notification or PARE leases need
their owning operator's review. `blocked` means the catalog, migration ledger,
or a blocking data check needs investigation. No status authorizes a repair.

## Data review

The preflight checks duplicate normalized account emails and active floorplan
drafts; orphan quote-to-request links; same-domain links whose related rows
disagree on event; invalid money, ratings, registration ranges, JSON shapes,
and billing sequences; audit chain and head integrity; PARE review-payload
digests; notification and PARE states; and expired queue leases. It reports
bounded opaque IDs in the artifact and counts in the console. Each finding
belongs to the owner named in the report.
Resolve it through that owner's reviewed repair and retain the original
evidence. Do not delete a row, fabricate a default, or relink by a name or
email to make the report pass.

## Populated upgrade and recovery evidence

The manifest-driven `db:backup:json` command exports the 93 owner-manifest
tables plus `public._prisma_migrations` from one repeatable-read snapshot. It
writes with owner-only file mode where supported and refuses to replace an
existing timestamped export. It is useful for local inspection, but it is not
a complete database backup or a restore strategy.

Before the schema cutover is accepted:

1. Create a real PostgreSQL backup of the approved sanitized representative
   dataset and record the matching old application artifact.
2. Restore it to a second loopback disposable database; never use the source
   database as the rehearsal target.
3. Capture the current-mode preflight artifact, apply the checked-in forward
   migrations with the matching application artifact, and capture the final
   artifact.
4. Compare row counts, sampled keys, table OIDs, constraints, indexes, selected
   historical-payload checksums, audit head, and money totals. A table move
   must preserve its OID and all retained data.
5. Restore the backup again to a different disposable database and verify the
   documented recovery path.

If a sanitized representative dataset is unavailable, add synthetic fixtures
for each known failure class and label that result synthetic. Synthetic data
does not prove compatibility with a real historical dataset.

The planned metadata-only move budget is a 5-second `lock_timeout` and a
60-second `statement_timeout`. Measure these on the populated rehearsal and
adjust the reviewed budget if legitimate workloads need more time. Production
blockers are never killed automatically. Full PostgreSQL replay, populated
upgrade, and alternate-database restore remain required acceptance gates; a
preflight dry-run or JSON export alone does not satisfy them.
