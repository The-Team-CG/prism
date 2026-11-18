# Documentation bundle update log

This log records changes to documentation structure and durable contracts. Release
notes are in [`../CHANGELOG.md`](../CHANGELOG.md). Git history retains detailed
implementation and verification history.

## 2026-11-18

- Consolidated the bundle after the Account, billing, files, messages and notification work. Removed the feature ledger's delivery overlay (its treatments were delivered or already recorded in the active ledger and implemented-slices tables) and the actual-system document's feature-family map and outcomes table (duplicates of the ledger and future state), and pointed its completion rule at future state. Added the account-email key to the external-reference lifecycle, described the shared `@prism/ui` screens in current architecture, added the Account page flows to portal accounts, and refreshed the notification screen description in the communications and integrations runbooks.
- Verified every runbook, product policy, ADR and architecture register against the code. The persistence register no longer claims database CHECK and JSON shape constraints that only the retired pre-baseline history had. ADR-0001 records that `packages/ui` may hold presentational shared screens. The index now links the UAT bank and the acceptance suites. The UAT question bank is generated from `uat/uat-test-cases.gs` and checked in CI, and the unmaintained `uat/PRISM-UAT-Form.xlsx` is removed.

## 2026-11-12

- Consolidated release and bundle logs. Retired the stale AI roadmap, promoted its current policy to [`product/ai-data-policy.md`](product/ai-data-policy.md), and kept open qualification evidence in [`runbooks/ai-provider-routing.md`](runbooks/ai-provider-routing.md).

## 2026-11-11

- Added runbooks for operational communications and optional external integrations, including delivery outcomes, acknowledgment escalation, startup configuration, signed Viber webhooks, and sealed Canva tokens.

## 2026-11-07

- Clarified context exports, owner-defined projections, portal-query refresh ownership, and shared guest-session and floorplan-shell state boundaries.

## 2026-11-02

- Added the developer-checks runbook and documented compiler ownership, pre-push selection, isolated CI/browser jobs, and required aggregate checks.

## 2026-10-29

- Reconciled architecture and runbooks with current context ownership, request validation, schema ownership, CI behavior, and fixture and migration commands. The documentation contract now treats completed plans and dated reviews as Git history, not living sources.

## 2026-10-14

- Added the Vercel services deployment runbook and documented shared workspace installation, runtime bindings, public mounts, and worker, storage, and workflow cutover limits.

## 2026-10-07

- Updated local operation guidance for generated Supabase environments, one canonical database URL, preserved databases, scoped Docker builds, and source syncing.

## 2026-10-06

- Reconciled schema and migration guidance with the seven owner-scoped baselines. Documented that replacing migration history does not change an existing database and that adopting the new history requires a backup-gated rebuild.

## 2026-10-05

- Recorded privacy legal-hold authority and linked the schema, migration, and operator procedure.

## 2026-09-30

- Recorded retirement of sample runtime routes and the guarded local fixture seed contract.

## 2026-09-29

- Established the canonical documentation bundle, its navigation indexes, constitution, and accepted architecture decisions.
