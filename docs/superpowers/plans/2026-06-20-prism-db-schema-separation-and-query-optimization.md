# Prism Database Schema Separation And Query Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Prism's Postgres tables out of the overloaded `public` schema into domain schemas, preserve ACID-safe workflow behavior, and add backend query-performance guardrails so Prisma is used intentionally instead of hiding inefficient access patterns.

**Architecture:** Keep one shared NestJS API and one Prisma client, but move physical Postgres tables into explicit schemas grouped by domain. Use Prisma multi-schema mapping (`schemas` in the datasource plus `@@schema(...)` on models) only after a validation spike confirms exact Prisma CLI behavior in this repo. Use hand-reviewed SQL migrations for schema creation, table moves, FK/index preservation, and optional compatibility views. Backend optimization is enforced through batching, scoped selects, keyset pagination, query-budget tests, and raw SQL only when Prisma cannot produce the needed Postgres plan.

**Tech Stack:** PostgreSQL/Supabase, Prisma 7, NestJS, `pg`, Vitest, TypeScript, PowerShell, existing `apps/api` migration scripts.

---

## Implementation Status: 2026-06-21

Implemented on branch `db/schema-migration-plan`:

- Prisma multi-schema mapping across 42 models with stable Prisma model names and normalized physical table names.
- Domain schema migrations for `floorplan`, `identity`, `event_core`, `supplier_ops`, `staffing_ops`, `finance_ops`, `compliance_ops`, `guest_ops`, and `trust_ops`.
- Phase 2 physical table rename migration plus normalized index and constraint rename block for already-created databases.
- FK/hot-path index migration for event, supplier, finance, audit, and notification paths.
- Live audit scripts for schema placement, naming, FK indexes, and performance reporting.
- Static query audit for N+1, unbounded reads, broad includes, offset pagination, raw SQL comments, and broad helper names.
- Targeted query fixes in billing, supplier verification, live operations, notification processing, inquiry portal-open handling, and bounded read-model/sample reads.
- Domain-specific function renames for generic controller handlers and PARE agent `run()` methods.
- Shared cursor pagination limit constants and `normalizePrismPageLimit()` in `@prism/types`.
- Transaction-scope comments across event-ops transaction callbacks to keep external IO outside DB transactions.

Verified after live Supabase deployment:

- `npm --workspace prism-api run prisma:validate`
- `npm --workspace prism-api run db:verify:offline`
- `npm --workspace prism-api run db:audit:queries`
- `npm --workspace prism-api run db:backup:json` exported 43 tables and 779 rows before migration deployment.
- `npm --workspace prism-api exec -- prisma migrate deploy` applied the schema, table rename, index, and corrective normalized-index migrations to the target database.
- `npm --workspace prism-api run db:audit:schemas` passed for 42 domain tables.
- `npm --workspace prism-api run db:audit:naming` passed for domain schemas, tables, columns, indexes, and constraints.
- `npm --workspace prism-api run db:audit:indexes` passed FK index coverage.
- `npm --workspace prism-api run db:status` reported the database schema is up to date with 26 migration rows.
- `npm --workspace prism-api run db:perf:report` printed a redacted top-20 `pg_stat_statements` report.
- `npm --workspace prism-api run typecheck`
- `npm --workspace @prism/types run test`
- `npm --workspace @prism/api-client run test`
- `npm --workspace prism-api run test:event-ops`
- `npm run check:boundaries`

Remaining follow-up:

- Re-run `db:perf:report` after representative app traffic; the current top rows are dominated by migration/admin/catalog queries rather than normal event-ops workload.

## Current Finding

All Prisma models in `apps/api/prisma/schema.prisma` currently map tables without `@@schema(...)`, so the physical tables live in `public`. Migration history also includes `20260426000000_remove_mvp_schema`, so this work must be treated as a deliberate new domain-schema design, not a casual reversal of older migrations.

## Non-Negotiable Rules

| Rule | Required behavior |
| --- | --- |
| ACID by default | Mutations that must succeed together use `prisma.$transaction` or one SQL transaction. External IO stays outside transactions. |
| Short transactions | No HTTP, AI, storage, or notification adapter work inside transaction callbacks. |
| Domain schemas | Runtime tables move out of `public`; `public._prisma_migrations` stays in `public`. |
| Lowercase identifiers | New schemas, tables, columns, indexes, constraints, and database functions use unquoted lowercase `snake_case`. |
| Phased renames | Phase 1 moves tables into schemas while keeping existing table names; Phase 2 removes redundant `ops_` table/model names after audits and tests are green. |
| No N+1 | Backend code cannot issue Prisma queries inside item loops. Batch by IDs, use joins, or document bounded exceptions. |
| No unbounded lists | Route-facing lists use `take`, cursor pagination, or a named bounded exception. |
| Indexed filters | Every FK and frequent `where/orderBy` pair has a matching index or explicit reason. |
| Explicit query shape | Read models use `select` by default. Broad `include` needs a bounded relation reason. |
| Raw SQL allowed | Use `queryRaw` for Postgres-specific optimization only with parameterization, index notes, and EXPLAIN evidence. |
| No secrets | Docs, migrations, and logs never include live DB URLs or credentials. |

## Proposed Schema Map

| Schema | Tables |
| --- | --- |
| `floorplan` | `floor_plans`, `floor_plan_objects`, `venue_templates`, `event_instances`, `published_snapshots`, `ops_floor_plan_drafts` |
| `identity` | `ops_users`, `ops_approval_requests`, `ops_login_history`, `ops_security_alerts` |
| `event_core` | `ops_inquiries`, `ops_events`, `ops_privacy_requests`, `ops_documents`, `ops_briefings` |
| `supplier_ops` | `ops_supplier_categories`, `ops_suppliers`, `ops_supplier_reviews`, `ops_supplier_reliability_notes`, `ops_supplier_certifications`, `ops_supplier_quote_requests`, `ops_supplier_quotes` |
| `staffing_ops` | `ops_coordinators`, `ops_coordinator_assignments`, `ops_event_day_tasks`, `ops_urgent_issues`, `ops_event_day_logs`, `ops_coordinator_reliability_notes` |
| `finance_ops` | `ops_billing_sources`, `ops_billing_statements`, `ops_payment_milestones`, `ops_payment_records` |
| `compliance_ops` | `ops_compliance_rules`, `ops_compliance_checks`, `ops_post_event_documents`, `ops_event_insights` |
| `guest_ops` | `ops_guest_check_ins`, `ops_guest_feedback` |
| `trust_ops` | `ops_audit_logs`, `ops_notification_logs`, `ops_ai_audit_logs`, `ops_ai_approval_records` |
| `public` | `_prisma_migrations` and optional temporary compatibility views only |

## Naming Normalization Standard

The schema move is not enough by itself. `ops_` is useful while every table lives in `public`, but it becomes redundant once ownership is expressed by schemas. Normalize in two controlled phases:

| Layer | Phase 1 behavior | Phase 2 behavior |
| --- | --- | --- |
| Database schemas | Add domain schemas such as `event_core`, `supplier_ops`, `finance_ops`, and `trust_ops`. | Keep schemas stable. |
| Database tables | Move current table names unchanged, for example `supplier_ops.ops_supplier_quote_requests`. | Rename redundant tables, for example `supplier_ops.quote_requests`. |
| Prisma models | Keep current model names such as `OpsSupplierQuoteRequest` and map them with `@@schema(...)`. | Rename models only after API tests are stable, for example `SupplierQuoteRequest`. |
| Backend functions | Keep route handlers stable unless touched. | Rename vague service helpers and exported functions when they cross domain boundaries. |

### Target Table Naming Examples

| Current table | Phase 1 table | Phase 2 target |
| --- | --- | --- |
| `public.ops_events` | `event_core.ops_events` | `event_core.events` |
| `public.ops_inquiries` | `event_core.ops_inquiries` | `event_core.inquiries` |
| `public.ops_briefings` | `event_core.ops_briefings` | `event_core.briefings` |
| `public.ops_supplier_quote_requests` | `supplier_ops.ops_supplier_quote_requests` | `supplier_ops.quote_requests` |
| `public.ops_supplier_quotes` | `supplier_ops.ops_supplier_quotes` | `supplier_ops.quotes` |
| `public.ops_billing_statements` | `finance_ops.ops_billing_statements` | `finance_ops.billing_statements` |
| `public.ops_payment_records` | `finance_ops.ops_payment_records` | `finance_ops.payment_records` |
| `public.ops_audit_logs` | `trust_ops.ops_audit_logs` | `trust_ops.audit_logs` |
| `public.ops_notification_logs` | `trust_ops.ops_notification_logs` | `trust_ops.notification_logs` |
| `public.ops_ai_audit_logs` | `trust_ops.ops_ai_audit_logs` | `trust_ops.ai_audit_logs` |
| `public.ops_guest_check_ins` | `guest_ops.ops_guest_check_ins` | `guest_ops.check_ins` |
| `public.ops_guest_feedback` | `guest_ops.ops_guest_feedback` | `guest_ops.feedback` |

### Function Naming Rules

Use domain-specific names instead of broad Prism-wide names. The `Prism` prefix is allowed only for shared package or API-boundary contracts such as `normalizePrismApiProblem` and `normalizePrismPageLimit`.

| Function purpose | Required pattern | Examples |
| --- | --- | --- |
| Normalizers | `normalize<DomainObject>` | `normalizeEmail`, `normalizeGuestAccessCode`, `normalizeBillingSchedule`, `normalizeSupplierQuoteStatus` |
| Reads | `list*`, `get*`, `build*`, `map*` | `listSuppliers`, `getEventDetail`, `buildEventInsightContext`, `mapSupplierQuote` |
| Writes | `create*`, `update*`, `submit*`, `approve*`, `reject*`, `archive*`, `execute*` | `submitBriefing`, `approveFloorPlanDraft`, `archiveEvent`, `executePrivacyRequest` |
| Policy | `can*`, `requireCan*`, `assertCan*`, `resolve*` | `canReadEvent`, `requireCanMutateOfficialFloorplan`, `assertCanTransition`, `resolveActor` |
| Background work | `run*Sweep`, `process*Queue` | `runConformeReminderSweep`, `runPaymentRiskSweep`, `processNotificationQueue` |

Rename candidates to capture during Phase 2:

| Current shape | Preferred shape |
| --- | --- |
| `state()` outside sample internals | `getSampleState()` |
| generic `run()` in PARE agents | `runPareBudgetAgent()`, `runPareRiskAgent()`, `runPareMessageDraftAgent()` |
| controller-facing `detail()` | `getEventDetail()` |
| controller-facing `workspace()` | `getClientWorkspace()`, `getSupplierWorkspace()`, `getCoordinatorWorkspace()` |
| broad `normalizePrism*` not crossing package/API boundaries | `normalize<SpecificThing>()` |


## Files To Touch

| File | Purpose |
| --- | --- |
| `apps/api/prisma/schema.prisma` | Add Prisma multi-schema datasource list and model `@@schema(...)` mappings. |
| `apps/api/prisma/migrations/<timestamp>_split_domain_schemas/migration.sql` | Create schemas and move tables with `ALTER TABLE ... SET SCHEMA ...`. |
| `apps/api/prisma/migrations/<timestamp>_rename_domain_tables/migration.sql` | Optional Phase 2 physical table rename migration after schema audits are green. |
| `apps/api/prisma/migrations/<timestamp>_add_performance_indexes/migration.sql` | Add FK and hot-path indexes. |
| `apps/api/scripts/db-schema-audit.mjs` | Verify expected tables are in expected schemas and no runtime tables remain in `public`. |
| `apps/api/scripts/db-naming-audit.mjs` | Verify lowercase identifiers and flag new redundant `ops_` table names after Phase 2 starts. |
| `apps/api/scripts/db-index-audit.mjs` | Verify every FK has a supporting index. |
| `apps/api/scripts/db-query-audit.mjs` | Fail likely N+1, unbounded `findMany`, broad `include`, undocumented raw SQL, and offset pagination. |
| `apps/api/scripts/db-performance-report.mjs` | Report slow queries from `pg_stat_statements` when enabled. |
| `apps/api/package.json` | Add audit/report scripts. |
| `apps/api/libs/modules/event-ops/src/services/event-read-models.service.ts` | Primary read-model batching and query-budget target. |
| `apps/api/libs/modules/event-ops/src/services/billing-operations.service.ts` | Remove event-loop milestone reads and harden payment transactions. |
| `apps/api/libs/modules/event-ops/src/services/supplier-network-workflow.service.ts` | Replace broad request fetch plus in-memory `.find(...)` with indexed predicates. |
| `packages/types/src/event-ops.ts` | Add cursor pagination contracts. |
| `docs/prism-v4/15-system-architecture.md`, `docs/prism-v4/17-current-state-2026-06-20.md`, `README.md` | Document DB domains, migration commands, and current state after implementation. |

## Task 1: Prisma Multi-Schema Validation Spike

**Files:** `apps/api/prisma/schema.prisma`

- [ ] Add temporary datasource syntax:

```prisma
datasource db {
  provider = "postgresql"
  schemas  = ["public", "floorplan"]
}
```

- [ ] Temporarily add `@@schema("floorplan")` to `FloorPlan` while keeping `@@map("floor_plans")`.
- [ ] Run `npm --workspace prism-api run prisma:validate`.
- [ ] Expected: schema validation succeeds. If Prisma rejects `schemas` or `@@schema`, stop and replace this plan with compatibility views/domain-prefix strategy.
- [ ] Revert the temporary spike with `git checkout -- apps/api/prisma/schema.prisma` and confirm `git diff -- apps/api/prisma/schema.prisma` is empty.
- [ ] Do not commit spike edits.

## Task 2: Map Prisma Models To Domain Schemas

**Files:** `apps/api/prisma/schema.prisma`

- [ ] Add datasource schemas:

```prisma
schemas = [
  "public",
  "floorplan",
  "identity",
  "event_core",
  "supplier_ops",
  "staffing_ops",
  "finance_ops",
  "compliance_ops",
  "guest_ops",
  "trust_ops",
]
```

- [ ] Add `@@schema("floorplan")` to `FloorPlan`, `FloorPlanObject`, `VenueTemplate`, `EventInstance`, `PublishedSnapshot`, `OpsFloorPlanDraft`.
- [ ] Add `@@schema("identity")` to `OpsUser`, `OpsApprovalRequest`, `OpsLoginHistory`, `OpsSecurityAlert`.
- [ ] Add `@@schema("event_core")` to `OpsInquiry`, `OpsEvent`, `OpsPrivacyRequest`, `OpsDocument`, `OpsBriefing`.
- [ ] Add `@@schema("supplier_ops")` to `OpsSupplierCategory`, `OpsSupplier`, `OpsSupplierReview`, `OpsSupplierReliabilityNote`, `OpsSupplierCertification`, `OpsSupplierQuoteRequest`, `OpsSupplierQuote`.
- [ ] Add `@@schema("staffing_ops")` to `OpsCoordinator`, `OpsCoordinatorAssignment`, `OpsEventDayTask`, `OpsUrgentIssue`, `OpsEventDayLog`, `OpsCoordinatorReliabilityNote`.
- [ ] Add `@@schema("finance_ops")` to `OpsBillingSource`, `OpsBillingStatement`, `OpsPaymentMilestone`, `OpsPaymentRecord`.
- [ ] Add `@@schema("compliance_ops")` to `OpsComplianceRule`, `OpsComplianceCheck`, `OpsPostEventDocument`, `OpsEventInsight`.
- [ ] Add `@@schema("guest_ops")` to `OpsGuestCheckIn`, `OpsGuestFeedback`.
- [ ] Add `@@schema("trust_ops")` to `OpsAuditLog`, `OpsNotificationLog`, `OpsAiAuditLog`, `OpsAiApprovalRecord`.
- [ ] Keep existing Prisma model names and `@@map("ops_*")` values in this task. Do not rename models or tables until Task 4A is complete and committed.
- [ ] Run `npm --workspace prism-api run prisma:validate`.
- [ ] Commit with `git commit -m "db: map Prisma models to domain schemas"`.

## Task 3: Create Safe Schema-Move Migration

**Files:** `apps/api/prisma/migrations/<timestamp>_split_domain_schemas/migration.sql`

- [ ] Create all target schemas:

```sql
CREATE SCHEMA IF NOT EXISTS floorplan;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS event_core;
CREATE SCHEMA IF NOT EXISTS supplier_ops;
CREATE SCHEMA IF NOT EXISTS staffing_ops;
CREATE SCHEMA IF NOT EXISTS finance_ops;
CREATE SCHEMA IF NOT EXISTS compliance_ops;
CREATE SCHEMA IF NOT EXISTS guest_ops;
CREATE SCHEMA IF NOT EXISTS trust_ops;
```

- [ ] Move tables with explicit schema-qualified statements:

```sql
ALTER TABLE IF EXISTS public.floor_plans SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.floor_plan_objects SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.venue_templates SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.event_instances SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.published_snapshots SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.ops_floor_plan_drafts SET SCHEMA floorplan;
ALTER TABLE IF EXISTS public.ops_users SET SCHEMA identity;
ALTER TABLE IF EXISTS public.ops_approval_requests SET SCHEMA identity;
ALTER TABLE IF EXISTS public.ops_login_history SET SCHEMA identity;
ALTER TABLE IF EXISTS public.ops_security_alerts SET SCHEMA identity;
ALTER TABLE IF EXISTS public.ops_inquiries SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_events SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_privacy_requests SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_documents SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_briefings SET SCHEMA event_core;
ALTER TABLE IF EXISTS public.ops_supplier_categories SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_suppliers SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_reviews SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_reliability_notes SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_certifications SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_quote_requests SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_supplier_quotes SET SCHEMA supplier_ops;
ALTER TABLE IF EXISTS public.ops_coordinators SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_coordinator_assignments SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_event_day_tasks SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_urgent_issues SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_event_day_logs SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_coordinator_reliability_notes SET SCHEMA staffing_ops;
ALTER TABLE IF EXISTS public.ops_billing_sources SET SCHEMA finance_ops;
ALTER TABLE IF EXISTS public.ops_billing_statements SET SCHEMA finance_ops;
ALTER TABLE IF EXISTS public.ops_payment_milestones SET SCHEMA finance_ops;
ALTER TABLE IF EXISTS public.ops_payment_records SET SCHEMA finance_ops;
ALTER TABLE IF EXISTS public.ops_compliance_rules SET SCHEMA compliance_ops;
ALTER TABLE IF EXISTS public.ops_compliance_checks SET SCHEMA compliance_ops;
ALTER TABLE IF EXISTS public.ops_post_event_documents SET SCHEMA compliance_ops;
ALTER TABLE IF EXISTS public.ops_event_insights SET SCHEMA compliance_ops;
ALTER TABLE IF EXISTS public.ops_guest_check_ins SET SCHEMA guest_ops;
ALTER TABLE IF EXISTS public.ops_guest_feedback SET SCHEMA guest_ops;
ALTER TABLE IF EXISTS public.ops_audit_logs SET SCHEMA trust_ops;
ALTER TABLE IF EXISTS public.ops_notification_logs SET SCHEMA trust_ops;
ALTER TABLE IF EXISTS public.ops_ai_audit_logs SET SCHEMA trust_ops;
ALTER TABLE IF EXISTS public.ops_ai_approval_records SET SCHEMA trust_ops;
```

- [ ] Keep `public._prisma_migrations` in `public`.
- [ ] Validate against local/shadow DB first: `npm --workspace prism-api run db:doctor`, `npm --workspace prism-api run prisma:validate`, and `npm --workspace prism-api exec -- prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`.
- [ ] Do not deploy to shared Supabase until backup/export exists and direct/shadow migration URL is approved. Pooler-only migration requires explicit approval and `ALLOW_POOLER_FOR_PRISMA=1`.
- [ ] Commit with `git commit -m "db: move Prism tables into domain schemas"`.

## Task 4: Add Schema Audit Script

**Files:** `apps/api/scripts/db-schema-audit.mjs`, `apps/api/package.json`

- [ ] Create `db-schema-audit.mjs` that queries `information_schema.tables` for all expected schema/table pairs in the schema map.
- [ ] Fail if any expected table is missing.
- [ ] Fail if any runtime base table remains in `public` except `_prisma_migrations`.
- [ ] Add package script: `"db:audit:schemas": "node --env-file=.env scripts/db-schema-audit.mjs"`.
- [ ] Run `npm --workspace prism-api run db:audit:schemas`.
- [ ] Expected after migration: `Schema audit passed for 42 domain tables.`
- [ ] Commit with `git commit -m "test: add domain schema audit"`.


## Task 4A: Add Naming Ledger And Naming Audit

**Files:** `docs/superpowers/plans/2026-06-20-prism-db-schema-separation-and-query-optimization.md`, `apps/api/scripts/db-naming-audit.mjs`, `apps/api/package.json`

- [ ] Treat the "Naming Normalization Standard" section in this plan as the naming ledger for Phase 1.
- [ ] Add `db-naming-audit.mjs` that queries `information_schema.schemata`, `information_schema.tables`, and `information_schema.columns`.
- [ ] Fail when any user-created schema, table, or column contains uppercase characters or requires quoted identifiers.
- [ ] Fail when new runtime tables are created in `public`, excluding `_prisma_migrations` and explicitly named temporary compatibility views.
- [ ] Warn, but do not fail in Phase 1, for moved tables that still have the legacy `ops_` prefix.
- [ ] Add package script: `"db:audit:naming": "node --env-file=.env scripts/db-naming-audit.mjs"`.
- [ ] Run `npm --workspace prism-api run db:audit:naming`.
- [ ] Expected after Task 3: `Naming audit passed with legacy ops-prefix warnings for Phase 2.`
- [ ] Commit with `git commit -m "test: add database naming audit"`.

## Task 4B: Plan And Execute Phase 2 Table Renames

**Files:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<timestamp>_rename_domain_tables/migration.sql`, service tests

- [ ] Do not start this task until `db:audit:schemas`, `db:audit:naming`, `db:audit:indexes`, `db:audit:queries`, API tests, and typecheck are green after Task 4A.
- [ ] Rename physical tables only inside their new schemas, for example:

```sql
ALTER TABLE IF EXISTS event_core.ops_events RENAME TO events;
ALTER TABLE IF EXISTS event_core.ops_inquiries RENAME TO inquiries;
ALTER TABLE IF EXISTS supplier_ops.ops_supplier_quote_requests RENAME TO quote_requests;
ALTER TABLE IF EXISTS supplier_ops.ops_supplier_quotes RENAME TO quotes;
ALTER TABLE IF EXISTS finance_ops.ops_billing_statements RENAME TO billing_statements;
ALTER TABLE IF EXISTS trust_ops.ops_audit_logs RENAME TO audit_logs;
```

- [ ] Update each Prisma model `@@map(...)` to the new table name while keeping model names stable, for example:

```prisma
model OpsEvent {
  @@schema("event_core")
  @@map("events")
}
```

- [ ] Create compatibility views only if an external script or dashboard still reads the old table name. Compatibility views must be schema-qualified and documented in this plan.
- [ ] Run `npm --workspace prism-api run prisma:validate`.
- [ ] Run `npm --workspace prism-api run test:event-ops`.
- [ ] Run `npm --workspace prism-api run db:audit:naming`.
- [ ] Convert the naming audit from Phase 1 warning mode to fail any newly introduced `ops_` table names outside the approved legacy list.
- [ ] Commit with `git commit -m "db: rename domain tables after schema split"`.

## Task 5: Add FK And Hot-Path Index Audits

**Files:** `apps/api/scripts/db-index-audit.mjs`, `apps/api/package.json`, new index migration

- [ ] Add a script based on `pg_constraint`, `pg_attribute`, and `pg_index` to fail every foreign key without a supporting index.
- [ ] Add package script: `"db:audit:indexes": "node --env-file=.env scripts/db-index-audit.mjs"`.
- [ ] Add missing FK indexes from audit output.
- [ ] Add hot-path indexes where not present:

```sql
CREATE INDEX IF NOT EXISTS ops_events_event_date_id_idx
  ON event_core.ops_events (event_date, id);
CREATE INDEX IF NOT EXISTS ops_events_archived_event_date_idx
  ON event_core.ops_events (event_date, id)
  WHERE archived = false;
CREATE INDEX IF NOT EXISTS ops_supplier_quote_requests_event_supplier_status_idx
  ON supplier_ops.ops_supplier_quote_requests (event_id, supplier_id, status);
CREATE INDEX IF NOT EXISTS ops_supplier_quotes_event_request_status_idx
  ON supplier_ops.ops_supplier_quotes (event_id, request_id, status);
CREATE INDEX IF NOT EXISTS ops_payment_milestones_event_due_date_idx
  ON finance_ops.ops_payment_milestones (event_id, due_date, id);
CREATE INDEX IF NOT EXISTS ops_audit_logs_event_created_at_id_idx
  ON trust_ops.ops_audit_logs (event_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS ops_notification_logs_status_created_at_id_idx
  ON trust_ops.ops_notification_logs (status, created_at, id);
```

- [ ] Run `npm --workspace prism-api run db:audit:indexes`.
- [ ] Expected: `FK index audit passed.`
- [ ] Commit with `git commit -m "db: add schema index audit and hot-path indexes"`.

## Task 6: Add Static Query Discipline Audit

**Files:** `apps/api/scripts/db-query-audit.mjs`, `apps/api/package.json`

- [ ] Create a static audit over tracked `apps/api/libs/modules/event-ops/src/**/*.ts` files.
- [ ] Fail Prisma calls inside `for (...)` loops unless a line contains `QUERY_AUDIT_ALLOW_BOUNDED_LOOP` with a reason.
- [ ] Fail `findMany({` without `where`, `take`, or a named bounded exception.
- [ ] Fail broad `include: {` without `QUERY_AUDIT_ALLOW_INCLUDE` and bounded relation explanation.
- [ ] Fail `skip:` without `QUERY_AUDIT_ALLOW_OFFSET`.
- [ ] Fail `$queryRaw`/`$executeRaw` without `QUERY_AUDIT_RAW_SQL` and index/EXPLAIN note.
- [ ] Fail exported service/helper names that use broad names such as `normalizePrism`, `normalizeData`, or `handleThing`. Allow `normalizePrismApiProblem` and `normalizePrismPageLimit` because they are package/API-boundary contracts.
- [ ] Add package script: `"db:audit:queries": "node scripts/db-query-audit.mjs"`.
- [ ] Run `npm --workspace prism-api run db:audit:queries` and fix real findings instead of weakening the script.
- [ ] Commit with `git commit -m "test: enforce backend query discipline"`.

## Task 7: Remove Known N+1 And Inefficient Reads

**Files:** `billing-operations.service.ts`, `supplier-network-workflow.service.ts`, `event-read-models.service.ts`, service tests

- [ ] In `billing-operations.service.ts`, replace event-loop milestone reads with one batched query:

```ts
const events = await this.prisma.opsEvent.findMany({ select: { id: true, eventName: true } });
const eventIds = events.map((event) => event.id);
const milestones = eventIds.length === 0
  ? []
  : await this.prisma.opsPaymentMilestone.findMany({
      where: { eventId: { in: eventIds } },
      orderBy: [{ eventId: 'asc' }, { dueDate: 'asc' }, { id: 'asc' }],
    });
```

- [ ] Add a test asserting `opsPaymentMilestone.findMany` is called once with `eventId: { in: [...] }`.
- [ ] In `supplier-network-workflow.service.ts`, replace broad fetch plus in-memory find with:

```ts
request = await this.prisma.opsSupplierQuoteRequest.findFirst({
  where: { eventId, supplierId },
  orderBy: { createdAt: 'desc' },
});
```

- [ ] Add a test asserting the indexed predicate is used.
- [ ] In `event-read-models.service.ts`, preserve existing `eventId: { in: eventIds }` batching and add query-count tests for each read-model path.
- [ ] Run `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run typecheck`, and `npm --workspace prism-api run db:audit:queries`.
- [ ] Commit with `git commit -m "perf: remove event ops N plus one query risks"`.

## Task 8: Add Cursor Pagination Contracts

**Files:** `packages/types/src/event-ops.ts`, `packages/types/src/event-ops.test.ts`, API controllers/services, API client tests

- [ ] Add shared types:

```ts
export interface PrismCursorPageRequest {
  cursor?: string;
  limit?: number;
}

export interface PrismCursorPage<T> {
  items: T[];
  nextCursor: string | null;
  limit: number;
}

export const PRISM_DEFAULT_PAGE_LIMIT = 25;
export const PRISM_MAX_PAGE_LIMIT = 100;
```

- [ ] Add `normalizePrismPageLimit(limit)` that returns 25 for invalid/low values, truncates decimals, and caps at 100.
- [ ] Test `undefined -> 25`, `0 -> 25`, `10.8 -> 10`, `250 -> 100`.
- [ ] Change route-facing audit, notification, event, and inbox lists to keyset pagination using stable cursors such as `createdAt + id` or `eventDate + id`.
- [ ] Extend query audit to fail `skip:` unless explicitly bounded.
- [ ] Run type/tests for `@prism/types`, `@prism/api-client`, and `prism-api`.
- [ ] Commit with `git commit -m "perf: add cursor pagination contracts"`.

## Task 9: ACID Transaction Review

**Files:** event-ops workflow services and tests

- [ ] Search transactions with `rg -n "\$transaction|fetch\(|send|notify|storage|upload|anthropic|ai" apps/api/libs/modules/event-ops/src/services`.
- [ ] Add before every remaining transaction callback:

```ts
// Transaction scope: DB reads/writes only. No external IO inside this callback.
```

- [ ] Replace state-changing `update` calls where concurrency matters with conditional `updateMany` and count checks:

```ts
const updated = await tx.opsSupplierQuote.updateMany({
  where: { id: quoteId, status: 'submitted' },
  data: { status: 'selected', selectedAt: now },
});

if (updated.count !== 1) {
  throw new Error('Quote is no longer selectable. Refresh and try again.');
}
```

- [ ] Add stale-state tests for every converted transition.
- [ ] Run `npm --workspace prism-api run test:event-ops` and `npm --workspace prism-api run typecheck`.
- [ ] Commit with `git commit -m "fix: harden event ops transaction boundaries"`.

## Task 10: Add Performance Monitoring Report

**Files:** `apps/api/scripts/db-performance-report.mjs`, `apps/api/package.json`, `README.md`

- [ ] Create a script that checks whether `pg_stat_statements` is enabled.
- [ ] If enabled, print top 20 queries by `mean_exec_time` with calls, rows, mean ms, and truncated query text.
- [ ] Add package script: `"db:perf:report": "node --env-file=.env scripts/db-performance-report.mjs"`.
- [ ] Document commands:

```bash
npm --workspace prism-api run db:audit:schemas
npm --workspace prism-api run db:audit:naming
npm --workspace prism-api run db:audit:indexes
npm --workspace prism-api run db:audit:queries
npm --workspace prism-api run db:perf:report
```

- [ ] Commit with `git commit -m "chore: add database performance report script"`.

## Task 11: Final Docs And Verification

**Files:** `docs/prism-v4/15-system-architecture.md`, `docs/prism-v4/17-current-state-2026-06-20.md`, `docs/prism-v4/MANIFEST.md`, `README.md`

- [ ] Add database schema-domain note to architecture docs.
- [ ] Update current-state docs to say whether the domain-schema migration is planned, applied locally, or deployed.
- [ ] Regenerate manifest byte counts.
- [ ] Run final verification:

```powershell
npm --workspace prism-api run prisma:validate
npm --workspace prism-api run typecheck
npm --workspace prism-api run test:event-ops
npm --workspace @prism/types run test
npm --workspace @prism/api-client run test
npm run check:boundaries
npm --workspace prism-api run db:audit:queries
npm --workspace prism-api run db:audit:schemas
npm --workspace prism-api run db:audit:naming
npm --workspace prism-api run db:audit:indexes
git diff --check
```

- [ ] If no live DB is available, do not claim schema deployment. Mark `db:audit:schemas` and `db:audit:indexes` as blocked on target DB access.
- [ ] Commit with `git commit -m "docs: document database schema domains"`.

## Rollout Order

1. Validate Prisma multi-schema support locally.
2. Implement Prisma mapping and schema-move migration.
3. Verify against a disposable/local/shadow database.
4. Add schema/naming/index/query audits.
5. Remove N+1 risks and add query-budget tests.
6. Add cursor pagination contracts.
7. Review ACID transaction scope and stale-state updates.
8. Back up the target Supabase database.
9. Deploy schema-move migration only after explicit approval and a viable migration URL.
10. Run schema/naming/index/query audits against target DB.
11. Rename physical tables only after the schema move is proven stable.
12. Run API tests, typechecks, and role boundary checks.

## Rollback Plan

1. Stop the API process.
2. Restore the pre-migration DB backup if the shared target DB was migrated.
3. If no post-migration writes occurred, reverse with `ALTER TABLE ... SET SCHEMA public` for every moved table.
4. Revert Prisma `schemas` and `@@schema(...)` changes.
5. Run `npm --workspace prism-api run prisma:validate`.
6. Run `npm --workspace prism-api run test:event-ops`.
7. Run `npm --workspace prism-api run db:doctor:runtime`.

## Self-Review

| Requirement | Coverage |
| --- | --- |
| Separate tables by schema | Tasks 1-4. |
| Normalize table/function names | Naming standard plus Tasks 4A, 4B, and 6. |
| Apply ACID principles | Task 9 and rollback plan. |
| No N+1 queries | Tasks 6-7. |
| Backend query optimization beyond generic Prisma defaults | Tasks 5, 7, 8, 10. |
| Supabase/Postgres good practices | FK indexes, partial indexes, pooling/direct migration separation, short transactions, monitoring. |
| Pooler/free-tier limitation | Rollout order blocks shared migration until backup and approved migration URL exist. |
