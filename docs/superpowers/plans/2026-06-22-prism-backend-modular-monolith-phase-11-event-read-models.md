# Event Read Models Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract role-scoped read payload composition into a dedicated `event-read-models` API module while preserving existing event-ops route contracts and keeping the module read-only.

**Architecture:** `event-read-models` owns PMCM dashboard, PMCM command inbox, selected PMCM event workspace, client workspace/action center, supplier workspace/readiness, and billing read-model composition. The module may use approved query-builder files for cross-domain reads and public reader ports from extracted modules; it must not mutate Prisma state or import `event-ops` compatibility internals. `event-ops` remains the HTTP compatibility facade and delegates existing route methods to the moved read-model service.

**Tech Stack:** NestJS modules/providers, TypeScript path aliases, Prisma read-only query builders, public provider tokens, Vitest unit/facade tests, Prism boundary checker.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend role-scoped contract foundation for the whole-app redesign. |
| Feature-ledger row | FL-001 lifecycle command surface, FL-002 client portal, FL-003 supplier portal, FL-006 guest/live attendance, FL-008 staffing, FL-022 audit/privacy, and the redesign dependency that role payloads must not leak PMCM-only fields. |
| Route/app/actor | Existing event-ops read routes used by `apps/event`, `apps/client`, and `apps/supplier`; actors are PMCM/system, client, and supplier. Guest payload remains owned by `guest-ops` and is consumed only through `GUEST_READER`. |
| Contract touched | API module internals and route DTO mappers only; no intentional `packages/types` or `packages/api-client` contract change. |
| Fallback state | Existing HTTP routes and `EventOpsService` facade stay; direct broad sample-state reads are not introduced. |
| Forbidden-role test | Client cannot read PMCM command inbox or PMCM event workspace, PMCM cannot read client action center, client cannot read supplier readiness, and supplier cannot read client workspace. |
| Query budget | One role root query plus bounded relation queries per payload family; no per-row Prisma loop. Query-builder files must include `Query budget:` comments. |
| Side-effect mode | `read_only`; no audit/outbox writes, Prisma mutations, `$executeRaw`, or write transactions. |
| Route-smoke evidence | `npm --workspace prism-api run test -- services/event-read-models.service.test.ts`, `npm --workspace prism-api run test -- event-ops.service.test.ts`, and `npm --workspace prism-api run test:event-ops`. |
| Docs updated | Master plan, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

---

## File Structure

- Create: `apps/api/libs/modules/event-read-models/src/event-read-models.module.ts` - runtime module for read models.
- Create: `apps/api/libs/modules/event-read-models/src/index.ts` - public barrel.
- Create: `apps/api/libs/modules/event-read-models/src/ports/event-read-models.tokens.ts` - read-model provider tokens.
- Create: `apps/api/libs/modules/event-read-models/src/ports/pmcm-event-read-model.port.ts` - PMCM dashboard/workspace contract.
- Create: `apps/api/libs/modules/event-read-models/src/ports/client-event-read-model.port.ts` - client workspace/action contract.
- Create: `apps/api/libs/modules/event-read-models/src/ports/supplier-event-read-model.port.ts` - supplier workspace/readiness contract.
- Create: `apps/api/libs/modules/event-read-models/src/ports/billing-read-model.port.ts` - billing read contract.
- Create: `apps/api/libs/modules/event-read-models/src/queries/event-read-models.queries.ts` - read-only Prisma query builder with query-budget comments.
- Create: `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.ts` - moved service.
- Create: `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.test.ts` - moved and expanded tests.
- Create: `apps/api/libs/modules/event-read-models/tsconfig.lib.json` - Nest library build config.
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.ts` - compatibility re-export.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts` - import `EventReadModelsModule`, remove local provider.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts` - import read-model service/types from public module.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` - instantiate moved service and query builder.
- Modify: `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` - aliases and project registration.
- Modify: master plan and Prism v4 architecture/current-state docs after verification.

---

## Task 1: Baseline Read-Model Role Coverage

**Files:**
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.test.ts`

- [ ] **Step 1: Add supplier-forbidden client workspace regression**

Add this test near the existing forbidden-role tests:

```ts
it('denies suppliers from client workspace records', async () => {
  const { service, policy } = createPmcmReadModelService();
  const actor = policy.resolveActor({
    actorRole: OpsUserRole.Supplier,
    supplierId: 'sup_sonicline',
    actorEmail: 'supplier@example.com',
  });

  await expect(
    service.clientWorkspace(actor, {
      mapEvent: (event) => event,
      mapDocument: (document) => document,
      mapBriefing: (briefing) => briefing,
      mapBillingStatement: (statement) => statement,
      mapPaymentMilestone: (payment) => payment,
      mapFloorPlanDraft: (draft) => draft,
      mapAuditLog: (log) => log,
    }),
  ).rejects.toThrow('supplier cannot access client workspace');
});
```

- [ ] **Step 2: Add PMCM selected-workspace forbidden-role regression**

Add this test near the PMCM workspace test:

```ts
it('denies clients from PMCM selected event workspace records', async () => {
  const { service, policy } = createPmcmReadModelService();
  const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

  await expect(
    service.pmcmEventWorkspace(actor, 'evt_visible', createPassthroughPmcmMappers()),
  ).rejects.toThrow('client cannot access PMCM event workspace');
});
```

Add this helper above the `describe` block so the mapper shape is explicit and reusable:

```ts
function createPassthroughPmcmMappers() {
  return {
    coordinatorRoleRequirements: [],
    mapUser: (user: any) => user,
    mapInquiry: (inquiry: any) => inquiry,
    mapEvent: (event: any) => event,
    mapDocument: (document: any) => document,
    mapBriefing: (briefing: any) => briefing,
    mapSupplierQuoteRequest: (request: any) => request,
    mapSupplierQuote: (quote: any) => quote,
    mapCoordinator: (coordinator: any) => coordinator,
    mapCoordinatorAssignment: (assignment: any) => assignment,
    mapComplianceRule: (rule: any) => rule,
    mapComplianceCheck: (check: any) => check,
    mapBillingSource: (source: any) => source,
    mapBillingStatement: (statement: any) => statement,
    mapPaymentMilestone: (payment: any) => payment,
    mapPaymentRecord: (record: any) => record,
    mapPostEventDocument: (document: any) => document,
    mapEventInsight: (insight: any) => insight,
    mapFloorPlanDraft: (draft: any) => draft,
    mapAuditLog: (log: any) => log,
    mapNotificationLog: (log: any) => log,
  };
}
```

- [ ] **Step 3: Run baseline read-model tests**

Run:

```bash
npm --workspace prism-api run test -- services/event-read-models.service.test.ts
```

Expected: PASS before extraction. These tests prove current behavior that must survive the move.

---

## Task 2: Create Event-Read-Models Module, Tokens, and Ports

**Files:**
- Create: `apps/api/libs/modules/event-read-models/src/event-read-models.module.ts`
- Create: `apps/api/libs/modules/event-read-models/src/index.ts`
- Create: `apps/api/libs/modules/event-read-models/src/ports/*.ts`
- Create: `apps/api/libs/modules/event-read-models/tsconfig.lib.json`

- [ ] **Step 1: Add public provider tokens**

Create `event-read-models.tokens.ts`:

```ts
export const PMCM_EVENT_READ_MODEL = Symbol('PMCM_EVENT_READ_MODEL');
export const CLIENT_EVENT_READ_MODEL = Symbol('CLIENT_EVENT_READ_MODEL');
export const SUPPLIER_EVENT_READ_MODEL = Symbol('SUPPLIER_EVENT_READ_MODEL');
export const BILLING_READ_MODEL = Symbol('BILLING_READ_MODEL');
```

- [ ] **Step 2: Add port interfaces**

Create the four port files using these signatures:

```ts
export interface PmcmEventReadModel {
  pmcmCommandInbox(actor: ResolvedEventOpsActor): Promise<unknown>;
  pmcmEventWorkspace(actor: ResolvedEventOpsActor, eventId: string, mappers: PmcmDashboardMappers): Promise<unknown>;
  pmcmDashboard(actor: ResolvedEventOpsActor, mappers: PmcmDashboardMappers): Promise<unknown>;
}

export interface ClientEventReadModel {
  clientWorkspace(actor: ResolvedEventOpsActor, mappers: ClientWorkspaceMappers): Promise<unknown>;
  clientActionCenter(actor: ResolvedEventOpsActor): Promise<unknown>;
}

export interface SupplierEventReadModel {
  supplierWorkspace(actor: ResolvedEventOpsActor, mappers: SupplierWorkspaceMappers): Promise<unknown>;
  supplierReadinessBoard(actor: ResolvedEventOpsActor): Promise<unknown>;
}

export interface BillingReadModel {
  billing(actor: ResolvedEventOpsActor, mappers: BillingReadModelMappers): Promise<unknown>;
}
```

Import `ResolvedEventOpsActor` from `@prism/modules/access-control`, and import mapper types from `../services/event-read-models.service`.

- [ ] **Step 3: Add module shell**

Create `event-read-models.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { EventReadModelQueries } from './queries/event-read-models.queries';
import { BILLING_READ_MODEL, CLIENT_EVENT_READ_MODEL, PMCM_EVENT_READ_MODEL, SUPPLIER_EVENT_READ_MODEL } from './ports/event-read-models.tokens';
import { EventReadModelsService } from './services/event-read-models.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, GuestOpsModule, StaffingOpsModule],
  providers: [
    EventReadModelQueries,
    EventReadModelsService,
    { provide: PMCM_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: CLIENT_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: SUPPLIER_EVENT_READ_MODEL, useExisting: EventReadModelsService },
    { provide: BILLING_READ_MODEL, useExisting: EventReadModelsService },
  ],
  exports: [EventReadModelsService, PMCM_EVENT_READ_MODEL, CLIENT_EVENT_READ_MODEL, SUPPLIER_EVENT_READ_MODEL, BILLING_READ_MODEL],
})
export class EventReadModelsModule {}
```

- [ ] **Step 4: Add barrel and tsconfig**

Create `index.ts` exporting module, ports, tokens, queries, and service. Create `tsconfig.lib.json` with `outDir` set to `../../../../dist/libs/modules/event-read-models`, include `src/**/*`, and exclude `**/*.test.ts`.

---

## Task 3: Move Read-Only Prisma Calls Into Query Builders

**Files:**
- Create: `apps/api/libs/modules/event-read-models/src/queries/event-read-models.queries.ts`
- Modify after move: `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.ts`

- [ ] **Step 1: Add the query builder class**

Create `EventReadModelQueries` with a constructor that injects `PrismaService`. Every method must have a `Query budget:` comment immediately above it.

Required query methods:

```ts
visibleEvents()
eventWithDrafts(eventId: string)
billingForEvents(eventIds: string[], includeInternalCosts: boolean)
clientWorkspaceForEvents(eventIds: string[])
clientActionCenterForEvents(eventIds: string[])
supplierWorkspaceForSupplier(supplierId: string)
supplierEvents(eventIds: string[])
pmcmCommandInbox()
pmcmEventWorkspace(eventId: string)
pmcmDashboard()
activeSuppliers()
supplierCategories()
boundedCoordinatorAssignments()
```

- [ ] **Step 2: Keep query builders read-only**

The query builder may use `findMany`, `findUnique`, `count`, `Promise.all`, and `$queryRaw` only when the file contains `Query budget:`. It must not use `create`, `update`, `upsert`, `delete`, `createMany`, `updateMany`, `deleteMany`, `$executeRaw`, `$transaction`, audit writers, or outbox writers.

- [ ] **Step 3: Replace direct Prisma calls in the moved service**

After Task 4 copies the service, replace direct `this.prisma.*` reads with `this.queries.*` calls. Keep mapping and role checks in `EventReadModelsService`; keep read mechanics in `EventReadModelQueries`.

---

## Task 4: Move EventReadModelsService To Owning Module

**Files:**
- Create from existing: `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.ts`
- Create from existing: `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.test.ts`
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.ts`

- [ ] **Step 1: Copy service and test to the new module path**

Copy the current implementation and test files into `event-read-models/src/services`. Do not delete the old files in this step.

- [ ] **Step 2: Update moved service imports**

Use public module imports:

```ts
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/modules/access-control';
import { AuditCategory, OpsUserRole, SupplierQuoteRequestStatus, isOpsConstantValue } from '@prism/modules/event-core';
import { GUEST_READER, type GuestReader } from '@prism/modules/guest-ops';
import { STAFFING_READER, type StaffingReader } from '@prism/modules/staffing-ops';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
```

Remove private imports from `../ops.constants`, `./event-access-policy.service`, and `./suppliers.service`.

- [ ] **Step 3: Update constructor dependencies**

Use this constructor:

```ts
constructor(
  private readonly queries: EventReadModelQueries,
  private readonly policy: EventAccessPolicyService,
  @Inject(GUEST_READER) private readonly guestReader: GuestReader,
  @Inject(STAFFING_READER) private readonly staffingReader: StaffingReader,
) {}
```

`EventReadModelsService` must not inject `PrismaService` directly after the query builder exists.

- [ ] **Step 4: Replace supplier and staffing reads**

Use `this.queries.activeSuppliers()` for supplier profile resolution, `this.queries.supplierCategories()` for PMCM dashboard categories, `this.staffingReader.listAssignmentsForEvent(eventId)` for selected-event coordinator assignments, and `this.staffingReader.listCoordinators()` for dashboard coordinator cards. Use `this.queries.boundedCoordinatorAssignments()` for the PMCM dashboard all-assignment list until a dedicated staffing dashboard reader exists.

- [ ] **Step 5: Keep legacy import path stable**

Replace `apps/api/libs/modules/event-ops/src/services/event-read-models.service.ts` with:

```ts
export * from '@prism/modules/event-read-models';
```

- [ ] **Step 6: Run moved service tests**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/event-read-models/src/services/event-read-models.service.test.ts
```

Expected: PASS.

---

## Task 5: Wire Event-Ops Through Event-Read-Models

**Files:**
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`

- [ ] **Step 1: Import `EventReadModelsModule` in event-ops**

Add `EventReadModelsModule` from `@prism/modules/event-read-models` to `EventOpsModule.imports`.

- [ ] **Step 2: Remove local read-model provider ownership**

Remove `EventReadModelsService` from `EVENT_OPS_PROVIDERS`; Nest must resolve it from `EventReadModelsModule`.

- [ ] **Step 3: Update service and test imports**

Import `EventReadModelsService`, `EventReadModelQueries`, and mapper types from `@prism/modules/event-read-models`.

- [ ] **Step 4: Update event-ops test helper**

Instantiate the moved service like this:

```ts
const eventReadModelQueries = new EventReadModelQueries(prisma as any);
const eventReadModelsService = new EventReadModelsService(
  eventReadModelQueries,
  eventAccessPolicyService,
  guestReader,
  coordinatorsService,
);
```

- [ ] **Step 5: Run facade tests**

Run:

```bash
npm --workspace prism-api run test -- event-ops.service.test.ts
npm --workspace prism-api run test:event-ops
```

Expected: PASS.

---

## Task 6: Register Aliases, Build, and Boundary Rules

**Files:**
- Modify: `apps/api/tsconfig.json`
- Modify: `apps/api/vitest.config.ts`
- Modify: `apps/api/nest-cli.json`

- [ ] **Step 1: Add TypeScript aliases**

Add:

```json
"@prism/modules/event-read-models": ["libs/modules/event-read-models/src/index"],
"@prism/modules/event-read-models/*": ["libs/modules/event-read-models/src/*"]
```

- [ ] **Step 2: Add Vitest alias**

Add this alias:

```ts
      '@prism/modules/event-read-models': resolve(__dirname, './libs/modules/event-read-models/src/index.ts'),
```

- [ ] **Step 3: Add Nest library project**

Add an `event-read-models` library project pointing to `libs/modules/event-read-models/tsconfig.lib.json`.

- [ ] **Step 4: Run build and boundary checks**

Run:

```bash
npm --workspace prism-api run build
npm run check:boundaries
rg -n "@prism/modules/event-ops|apps/api/libs/modules/event-ops|from './services/event-read-models.service'|from '../services/event-read-models.service'" apps/api/libs/modules/event-read-models apps/api/libs/modules/event-ops/src/event-ops.service.ts apps/api/libs/modules/event-ops/src/event-ops.module.ts
rg -n "\.create\(|\.update\(|\.upsert\(|\.delete\(|\.createMany\(|\.updateMany\(|\.deleteMany\(|\$executeRaw" apps/api/libs/modules/event-read-models/src
```

Expected: build and boundary check pass. The first `rg` must not report event-read-models importing event-ops or event-ops importing private read-model service paths. The second `rg` must return no mutation calls in `event-read-models/src`.

---

## Task 7: Documentation and Completion Checks

**Files:**
- Modify: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`
- Modify: `docs/prism-v4/15-system-architecture.md`
- Modify: `docs/prism-v4/17-current-state-2026-06-20.md`

- [ ] **Step 1: Mark Phase 11 complete in the master plan**

Only check Phase 11 boxes after all Task 6 commands pass.

- [ ] **Step 2: Update architecture/current-state docs**

Record that `event-read-models` owns role-scoped PMCM/client/supplier/billing read models through read-only query builders and public guest/staffing reader ports. Record that controller ownership remains in `event-ops` until Phase 13.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/event-read-models/src/services/event-read-models.service.test.ts
npm --workspace prism-api run test -- services/event-read-models.service.test.ts
npm --workspace prism-api run test -- event-ops.service.test.ts
npm --workspace prism-api run test:event-ops
npm --workspace prism-api run build
npm run check:boundaries
rg -n "@prism/modules/event-ops|apps/api/libs/modules/event-ops" apps/api/libs/modules/event-read-models
rg -n "\.create\(|\.update\(|\.upsert\(|\.delete\(|\.createMany\(|\.updateMany\(|\.deleteMany\(|\$executeRaw" apps/api/libs/modules/event-read-models/src
git diff --check
```

Expected: targeted read-model tests, facade tests, full event-ops tests, build, boundary check, no event-ops imports from `event-read-models`, no Prisma mutations in `event-read-models`, and diff check pass.

- [ ] **Step 4: Commit implementation**

Commit message:

```bash
git add apps/api docs
git commit -m "refactor(api): extract event read models module"
```

---

## Self-Review

- Spec coverage: Covers Phase 11 module creation, service movement, no event-ops imports, public read-model tokens, role-scoped PMCM/client/supplier payloads, read-only query builders, guest/staffing reader ports, tests, build, boundary checks, and docs.
- Boundary clarity: The plan intentionally keeps controllers in `event-ops` until Phase 13 and does not create generic repositories. Query builders are read-model-specific and include query-budget comments.
- Placeholder scan: No unfinished-marker or generic test instructions remain; every task names files, code shape, commands, and expected results.
- Type consistency: `EventReadModelsService`, `EventReadModelQueries`, `PmcmDashboardMappers`, `ClientWorkspaceMappers`, `SupplierWorkspaceMappers`, `BillingReadModelMappers`, `PMCM_EVENT_READ_MODEL`, `CLIENT_EVENT_READ_MODEL`, `SUPPLIER_EVENT_READ_MODEL`, and `BILLING_READ_MODEL` are used consistently.