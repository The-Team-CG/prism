---
type: "Playbook"
title: "Prism audit-chain preproduction repair"
description: "Safely canonicalize and rehash a single preproduction audit chain after PostgreSQL JSONB key reordering made historical hashes unverifiable."
tags: [runbook, platform-ops, audit, database, integrity, recovery]
status: canonical
updated: "2026-10-04"
authority: operational
owner: "D (Anthony)"
audience: [developers, reviewers, operators, agents]
scope: "apps/api trust_ops.audit_logs hash verification and the guarded preproduction repair CLI"
last_verified: "codex/pr17g-audit-hash-stability-on-pr17f"
sources:
  - id: audit-chain
    resource: "apps/api/src/modules/platform-ops/application/trust/audit-chain.ts"
    title: "Platform audit chain writer and verifier"
  - id: repair-cli
    resource: "apps/api/scripts/repair-audit-chain.mjs"
    title: "Guarded audit repair command"
  - id: audit-schema
    resource: "apps/api/prisma/schema.prisma"
    title: "Platform audit persistence model"
---
# Prism audit-chain preproduction repair

## At a glance

- **Purpose:** Repair a single preproduction audit chain when JSONB key
  reordering prevents the old insertion-order hash from being recomputed.
- **Owner:** D (Anthony); the owner approval reference is recorded in the
  checkpoint row.
- **Target:** Development, staging, or preproduction only. The command refuses
  `NODE_ENV=production` and does not accept `production` as its repair target.
- **Required evidence:** A restorable full-database backup, the backup reference,
  an access-controlled pre-repair audit snapshot, and the owner approval
  reference.
- **Verification:** A read-only dry run before repair, in-transaction full-chain
  verification before commit, and a second dry run after repair.

## What changes

New audit writes use domain-separated SHA-256 over recursively key-sorted JSON;
array order remains significant. The verifier continues accepting legacy hashes
when their original JSON serialization still matches.

The one-time repair follows the existing `previous_hash` links, then replaces
`immutable_hash` and `previous_hash` for every row in that single chain. It keeps
row IDs, event attribution, actors, actions, metadata, and timestamps unchanged.
It appends a warning-level checkpoint row containing the old and new chain
references, source digest, backup reference, and approval reference. The chain
head is updated in the same transaction.

This rehash attests to the stored records as they exist after JSONB normalization.
It cannot recover the original metadata key order. The pre-repair backup is the
recovery source for the old hash representation.

The command refuses malformed hashes, multiple roots, forks, missing parents,
disconnected rows, and an already-verifiable history. Those states require
separate investigation; this procedure never guesses how to join histories. A
populated singleton chain head must match the linked history tail. A completely
empty lock head is accepted for installations that predate head tracking; a
partially populated or stale head is refused.

## Procedure

1. Schedule a preproduction maintenance window and stop or drain API writers.
   The CLI takes the global audit-chain row lock and a table lock, so active
   audit appenders wait until the transaction ends.
2. Take a full database backup and verify that it can be restored. Keep its
   reference and restore evidence available to the owner. A JSON export of only
   `audit_logs` is not a substitute for the full backup.
3. Set `DIRECT_URL` to the direct connection for the intended nonproduction
   database. Do not use a pooler. Set the repair environment explicitly:

   ```powershell
   $env:PRISM_AUDIT_REPAIR_ENV = "preproduction"
   ```

4. Run the default read-only preview with the expected database name:

   ```powershell
   npm --workspace prism-api run db:audit:repair -- --expected-database <database-name>
   ```

   Review the connected database and host, `invalidHashCount`, root/tail IDs,
   and `sourceSha256`. `canonicalValid: false` and a positive invalid count are
   expected for the reported JSONB ordering defect. The preview changes no rows.
5. Apply only after the backup and owner approval references are ready. Copy the
   exact digest from the reviewed preview:

   ```powershell
   npm --workspace prism-api run db:audit:repair -- `
     --apply `
     --environment preproduction `
     --expected-database <database-name> `
     --expected-host <host-and-port-from-reviewed-preview> `
     --expected-source-sha256 <reviewed-sha256> `
     --backup-reference <verified-backup-reference> `
     --approval-reference <owner-approval-reference> `
     --snapshot-file <absolute-secure-path-outside-repo> `
     --acknowledge-historical-hash-rewrite
   ```

   The CLI rebuilds the chain and inserts its checkpoint in one serializable
   transaction. It commits only if every row, including the checkpoint, passes
   canonical full-chain verification. Any error rolls the transaction back.
   The audit snapshot is created exclusively, flushed to disk before database
   updates, and its SHA-256 is stored in the checkpoint. Keep that file in an
   access-controlled location; it contains audit payload data.
6. Run the read-only preview again against the same expected database. Confirm
   `invalidHashCount: 0` and `canonicalValid: true`, then run the API's normal
   audit-integrity check and verify a normal audit append succeeds.
7. Retain the CLI result, backup/restore evidence, approval reference, and the
   checkpoint row as the repair record.

## Recovery and limits

The operation changes historical hash and link columns, so the exact old chain
cannot be restored by rerunning the command. If the post-repair verification or
application check fails after commit, stop audit writers and restore the
verified pre-repair database backup using the approved database recovery
procedure. Do not run this utility against production or use it to reconcile a
forked, disconnected, or otherwise ambiguous graph.
