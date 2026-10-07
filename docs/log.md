# Documentation bundle update log

This log tracks changes to documentation structure and durable contracts. Release
notes are in [`../CHANGELOG.md`](../CHANGELOG.md); Git history retains detailed
implementation and verification history.

## 2026-10-07

- Local operation now uses generated Supabase environments with local API/portal URLs, one canonical database URL, and preserved databases per migration baseline. Docker runbooks describe source syncing and scoped standalone images.

## 2026-10-06

- Reconciled architecture, persistence, and column inventories with the
  94-table, 1,191-column, seven-owner-schema baseline. Clarified that replacing
  migration history does not alter an existing database and documented the
  backup-gated pre-production rebuild.
- Replaced the 102-folder pre-production migration history with seven
  owner-scoped baselines and updated local replay/adoption guidance.
- Simplified onboarding and changelog guidance, indexed active roadmaps, and fixed
  stale references. Removed superseded review reports, the duplicate TODO, and
  stale Playwright snapshots.

## 2026-10-05

- Recorded privacy legal-hold scope and authority in ADR-0009 and linked the
  schema, migration, and operator procedure.

## 2026-10-04

- Added the external-reference lifecycle register, column authority inventory,
  and audit-chain repair procedure.

## 2026-10-03

- Promoted staffing and event-day policy decisions into the feature ledger and
  current architecture references.

## 2026-09-30

- Recorded retirement of sample runtime routes and the guarded local fixture seed
  path in ADR-0007 and the portal runbook.

## 2026-09-29

- Established the canonical OKF-style documentation bundle, its indexes and
  constitution, and the initial accepted architecture decisions.

## 2026-09-28

- Recorded synthetic-only AI routing guidance and the decision to defer real-data activation.
