# Prism Backend Modular Monolith Phase 5 Finance Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `BillingOperationsService` into `finance-ops` as the first finance capability module while preserving existing billing routes, PMCM/client read behavior, audit/outbox side effects, and payment mutation safety.

**Architecture:** Keep `event-ops` as the route compatibility facade for this phase. `finance-ops` owns billing/payment commands and exports public command/reader tokens. Unlike the supplier slice, billing already depends only on Prisma plus public cross-cutting modules, so `FinanceOpsModule` should provide and export `BillingOperationsService` directly.

**Tech Stack:** NestJS modules/providers, PrismaService, `@prism/modules/event-core`, `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, Vitest, TypeScript path aliases, existing event-ops route tests, and `scripts/check-prism-boundaries.mjs`.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Platform trust through finance command ownership, payment mutation safety, and role-safe billing contracts. |
| Feature-ledger row | FL-005 proposal/briefing/commercial workflow where approved proposal feeds billing; FL-010 billing and payments; FL-017 command inbox billing rows; FL-018 event health payment readiness. |
| Route/app/actor | Existing `apps/api` routes: `GET /billing`, `POST /events/:eventId/billing-source`, `PATCH /events/:eventId/billing-source/:sourceId/approve`, `POST /events/:eventId/billing-statements/generate`, `PATCH /events/:eventId/payments/:milestoneId`, `POST /events/:eventId/payments/:milestoneId/records`, `POST /events/:eventId/billing-statements/:billingId/send`. PMCM/system can mutate; client reads only client-safe billing payloads through existing read models; supplier/guest must not read PMCM finance payloads. |
| Contract touched | Backend module exports and API TypeScript aliases. `packages/types` and API-client changes are out of scope unless adding optional payment idempotency evidence requires a type-only optional field. |
| Fallback state | Existing `event-ops` route facade and sample-state compatibility stay unchanged. No route path changes. |
| Forbidden-role test | Existing event-ops read tests must keep passing; add or preserve evidence that supplier/guest actors cannot access PMCM finance payloads. If no narrow existing assertion exists, add it to `event-ops.service.test.ts` before closing this phase. |
| Query budget | Command extraction is not a read-model extraction. Billing read payloads stay in `EventReadModelsService`; no new read query loops are allowed. |
| Side-effect mode | `markPayment`: existing audit/outbox side effects are after the milestone update; preserve. `recordPayment`: mutation is same DB transaction for payment record plus milestone totals, with audit after commit; add idempotency guard before create. `createBillingSource` and `approveBillingSource`: audit after write; preserve. `generateBillingStatement`: document, statement, and milestones in one DB transaction, audit after commit; preserve. `sendBillingStatement`: status update plus audit/outbox after write; preserve. |
| Route-smoke evidence | `npm --workspace prism-api run test -- libs/modules/finance-ops/src/services/billing-operations.service.test.ts`, `npm --workspace prism-api run test -- libs/modules/event-ops/src/event-ops.service.test.ts`, `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, `npm run check:boundaries`. |
| Docs updated | Parent Phase 5 checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## Current Findings

- `apps/api/libs/modules/event-ops/src/services/billing-operations.service.ts` imports only Prisma/database helpers, event-operation constants, `AuditService`, `NotificationOutboxService`, and `WorkflowCommandService`.
- There is no dedicated `billing-operations.service.test.ts` today. Billing behavior is covered indirectly by `event-ops.service.test.ts` and read-model tests.
- `recordPayment` writes `OpsPaymentRecord` and recalculates `OpsPaymentMilestone` totals inside one Prisma transaction, but it can duplicate a retried payment request because it has no idempotency guard.
- `OpsPaymentRecord` has no idempotency-key column. The safe Phase 5 guard is deterministic duplicate detection using `milestoneId`, `amountReceived`, `paymentDate`, `paymentMethod`, and non-empty `referenceNumber`; schema changes for a formal idempotency key are deferred to a separate migration plan.
- Billing read models and client/supplier/guest visibility still live in `event-ops` read-model composition. Do not move `EventReadModelsService` in this phase.

## Scope Rules

In scope:

- Create `apps/api/libs/modules/finance-ops`.
- Move `BillingOperationsService` and add a focused service test.
- Create `FinanceOpsModule` that imports `DatabaseModule`, `EventCoreModule`, `TrustOpsModule`, and `NotificationOpsModule`, then provides/exports `BillingOperationsService` and public finance tokens.
- Add public ports/tokens: `FINANCE_COMMANDS`, `BILLING_READER`, and `PAYMENT_STATUS_READER`.
- Preserve existing `event-ops` route paths by importing `FinanceOpsModule` into `EventOpsModule` and using a compatibility re-export at the old service path.
- Add payment idempotency guard for retried payment records with a non-empty reference number.
- Update docs and parent Phase 5 checklist only after verification passes.

Out of scope:

- Moving `EventReadModelsService`, billing controllers, proposal/commercial workflows, file/document storage ownership, event health computation, package/API-client route helpers, database schema migrations, disputes, waivers, corrections, and additional billing workflows.
- Adding a generic repository, base finance service, event bus, or table-per-module abstraction.
- Changing public HTTP route paths or required request fields.

## Files To Create Or Move

| File | Purpose |
| --- | --- |
| `apps/api/libs/modules/finance-ops/src/services/billing-operations.service.ts` | Moved finance command owner. |
| `apps/api/libs/modules/finance-ops/src/services/billing-operations.service.test.ts` | Focused command tests for payment transaction/idempotency and mapping. |
| `apps/api/libs/modules/finance-ops/src/finance-ops.module.ts` | Real finance module that provides/exports billing operations and finance tokens. |
| `apps/api/libs/modules/finance-ops/src/ports/finance-ops.tokens.ts` | `FINANCE_COMMANDS`, `BILLING_READER`, `PAYMENT_STATUS_READER` tokens. |
| `apps/api/libs/modules/finance-ops/src/ports/finance-commands.port.ts` | Public command interface for billing source, statement, and payment mutations delegated by `EventOpsService`. |
| `apps/api/libs/modules/finance-ops/src/ports/billing-reader.port.ts` | Future reader contract for read-model extraction; do not implement reads here yet. |
| `apps/api/libs/modules/finance-ops/src/ports/payment-status-reader.port.ts` | Future reader contract for payment status/event health extraction; do not implement reads here yet. |
| `apps/api/libs/modules/finance-ops/src/index.ts` | Public finance exports. |
| `apps/api/libs/modules/finance-ops/tsconfig.lib.json` | Finance library tsconfig. |
| `apps/api/libs/modules/event-ops/src/services/billing-operations.service.ts` | Compatibility re-export from `@prism/modules/finance-ops`. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import `FinanceOpsModule`; remove local `BillingOperationsService` provider. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Import `BillingOperationsService` from `@prism/modules/finance-ops` for direct construction. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add finance-ops aliases and Nest metadata. |
| Docs listed in the evidence gate | Record completed state and remaining finance dependencies. |

## Task 1 - Add Focused Finance Test Before Moving

- [ ] Create `apps/api/libs/modules/event-ops/src/services/billing-operations.service.test.ts` with a failing idempotency test for `recordPayment`.

Use this test shape. It should initially fail because duplicate reference-number detection does not exist yet:

```ts
import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/modules/event-core';
import { BillingOperationsService } from './billing-operations.service';

function createPaymentService() {
  const milestone = {
    id: 'pay_downpayment',
    eventId: 'evt_sample',
    label: 'Downpayment',
    percentage: 50,
    amount: 100000,
    amountPaid: 25000,
    remainingBalance: 75000,
    dueDate: new Date('2026-07-01T00:00:00.000Z'),
    status: 'partially_paid',
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
  };
  const existingRecord = {
    id: 'payrec_existing',
    eventId: 'evt_sample',
    milestoneId: 'pay_downpayment',
    amountReceived: 25000,
    paymentDate: new Date('2026-06-20T00:00:00.000Z'),
    paymentMethod: 'Bank Transfer',
    referenceNumber: 'BNK-123',
    recordedAt: new Date('2026-06-20T01:00:00.000Z'),
  };
  const history = [existingRecord];
  const prisma = {
    opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_sample' })) },
    opsPaymentMilestone: {
      findUnique: vi.fn(async () => milestone),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(milestone, data)),
    },
    opsPaymentRecord: {
      findMany: vi.fn(async () => history),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const record = { ...existingRecord, ...data, recordedAt: new Date('2026-06-21T00:00:00.000Z') };
        history.push(record as typeof existingRecord);
        return record;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: typeof prisma) => unknown) => callback(prisma)),
  };
  const audit = { audit: vi.fn() };
  const notifications = { queue: vi.fn() };
  const service = new BillingOperationsService(prisma as any, audit as any, notifications as any, new WorkflowCommandService());
  return { service, prisma, audit, history };
}

describe('BillingOperationsService', () => {
  it('does not duplicate a retried payment record with the same reference number', async () => {
    const { service, prisma, audit, history } = createPaymentService();

    const result = await service.recordPayment(
      'evt_sample',
      'pay_downpayment',
      {
        amountReceived: 25000,
        paymentDate: '2026-06-20',
        paymentMethod: 'Bank Transfer',
        referenceNumber: 'BNK-123',
      },
      { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test' },
    );

    expect(prisma.opsPaymentRecord.create).not.toHaveBeenCalled();
    expect(audit.audit).not.toHaveBeenCalled();
    expect(history).toHaveLength(1);
    expect(result.amountPaid).toBe(25000);
    expect(result.remainingBalance).toBe(75000);
    expect(result.history).toHaveLength(1);
  });
});
```

- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/billing-operations.service.test.ts`.
  Expected before implementation: FAIL because `recordPayment` creates a duplicate row.

## Task 2 - Create Finance-Ops Module Shell

- [ ] Create directories `apps/api/libs/modules/finance-ops/src/ports` and `apps/api/libs/modules/finance-ops/src/services`.
- [ ] Add `apps/api/libs/modules/finance-ops/tsconfig.lib.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../../dist/libs/modules/finance-ops"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

- [ ] Add `@prism/modules/finance-ops` and `@prism/modules/finance-ops/*` to `apps/api/tsconfig.json`.
- [ ] Add `@prism/modules/finance-ops` to `apps/api/vitest.config.ts`.
- [ ] Add a `finance-ops` library project to `apps/api/nest-cli.json` with root `libs/modules/finance-ops`, entry `index`, source root `libs/modules/finance-ops/src`, and tsconfig `libs/modules/finance-ops/tsconfig.lib.json`.

## Task 3 - Move Billing Operations Into Finance-Ops

- [ ] Run:

```powershell
git mv apps/api/libs/modules/event-ops/src/services/billing-operations.service.ts apps/api/libs/modules/finance-ops/src/services/billing-operations.service.ts
git mv apps/api/libs/modules/event-ops/src/services/billing-operations.service.test.ts apps/api/libs/modules/finance-ops/src/services/billing-operations.service.test.ts
```

- [ ] Update moved service imports:

```ts
import { AuditActionType, AuditCategory, WorkflowCommandService } from '@prism/modules/event-core';
import { AuditService } from '@prism/modules/trust-ops';
import { NotificationOutboxService } from '@prism/modules/notification-ops';
```

- [ ] Remove the old relative imports from `../ops.constants`, `./audit.service`, `./notification-outbox.service`, and `./workflow-command.service`.
- [ ] Create `apps/api/libs/modules/event-ops/src/services/billing-operations.service.ts` as:

```ts
export * from '@prism/modules/finance-ops';
```

- [ ] Update the moved test import path to keep `BillingOperationsService` from `./billing-operations.service` and `WorkflowCommandService` from `@prism/modules/event-core`.

## Task 4 - Add Finance Ports And Module

- [ ] Create `apps/api/libs/modules/finance-ops/src/ports/finance-ops.tokens.ts`:

```ts
export const FINANCE_COMMANDS = Symbol('FINANCE_COMMANDS');
export const BILLING_READER = Symbol('BILLING_READER');
export const PAYMENT_STATUS_READER = Symbol('PAYMENT_STATUS_READER');
```

- [ ] Create `apps/api/libs/modules/finance-ops/src/ports/finance-commands.port.ts` with the command interface used by `EventOpsService`:

```ts
import type { OpsBillingSource, OpsBillingStatement, OpsPaymentMilestone } from '@prisma/client';

export type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
};

export type CreateBillingSourceInput = {
  sourceType?: string;
  sourceLabel: string;
  sourceDocumentId?: string;
  lineItems: Array<{ label: string; amount: number }>;
  paymentSchedule?: Array<{ label: string; percentage: number; dueDate?: string }>;
  paymentMethods?: Array<{ label: string; details: string }>;
};

export type ApproveBillingSourceInput = {
  approvedBy?: string;
  approvalNotes?: string;
};

export type BillingActor = {
  name: string;
  role?: string;
  email?: string;
};

export interface FinanceCommands {
  runPaymentRiskSweep(): Promise<void>;
  markPayment(eventId: string, milestoneId: string, status: string, actor?: BillingActor): Promise<unknown>;
  recordPayment(eventId: string, milestoneId: string, input: RecordPaymentInput, actor?: BillingActor): Promise<unknown>;
  createBillingSource(eventId: string, input: CreateBillingSourceInput, actor: BillingActor): Promise<unknown>;
  approveBillingSource(eventId: string, sourceId: string, input: ApproveBillingSourceInput, actor: BillingActor): Promise<unknown>;
  generateBillingStatement(eventId: string, sourceId?: string, actor?: BillingActor): Promise<unknown>;
  sendBillingStatement(eventId: string, billingId: string, actor?: BillingActor): Promise<unknown>;
  mapBillingSource(source: OpsBillingSource): unknown;
  mapBillingStatement(statement: OpsBillingStatement): unknown;
  mapPaymentMilestone(payment: OpsPaymentMilestone, history?: unknown[]): unknown;
}
```

- [ ] Create `billing-reader.port.ts`:

```ts
export interface BillingReader {
  getBillingForEvent(eventId: string): Promise<unknown>;
}
```

- [ ] Create `payment-status-reader.port.ts`:

```ts
export interface PaymentStatusReader {
  getPaymentStatusForEvent(eventId: string): Promise<unknown>;
}
```

- [ ] Create `apps/api/libs/modules/finance-ops/src/finance-ops.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { FINANCE_COMMANDS } from './ports/finance-ops.tokens';
import { BillingOperationsService } from './services/billing-operations.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule],
  providers: [BillingOperationsService, { provide: FINANCE_COMMANDS, useExisting: BillingOperationsService }],
  exports: [BillingOperationsService, FINANCE_COMMANDS],
})
export class FinanceOpsModule {}
```

- [ ] Create `apps/api/libs/modules/finance-ops/src/index.ts` exporting module, ports, tokens, and service.

## Task 5 - Implement Payment Retry Idempotency Guard

- [ ] In `recordPayment`, after loading `existingHistory` and before calculating `currentPaid`, add duplicate detection for non-empty `referenceNumber`:

```ts
const requestedReference = input.referenceNumber?.trim() ?? '';
const requestedPaymentDate = parseDate(input.paymentDate);
const duplicateRecord = requestedReference
  ? existingHistory.find((record) =>
      record.referenceNumber === requestedReference &&
      record.amountReceived === input.amountReceived &&
      isoDate(record.paymentDate) === isoDate(requestedPaymentDate) &&
      record.paymentMethod === input.paymentMethod,
    )
  : null;
```

- [ ] Use this control-flow shape in `recordPayment` so duplicate replay returns the current durable result without creating or auditing again:

```ts
let milestone: OpsPaymentMilestone | null = null;
let paymentDate: Date | null = null;
let duplicateReplay: { payment: OpsPaymentMilestone; history: OpsPaymentRecord[] } | null = null;

// inside validateState, after existingHistory is loaded
const requestedReference = input.referenceNumber?.trim() ?? '';
paymentDate = parseDate(input.paymentDate);
const duplicateRecord = requestedReference
  ? existingHistory.find((record) =>
      record.referenceNumber === requestedReference &&
      record.amountReceived === input.amountReceived &&
      isoDate(record.paymentDate) === isoDate(paymentDate!) &&
      record.paymentMethod === input.paymentMethod,
    )
  : null;
if (duplicateRecord) {
  const amountPaid = existingHistory.reduce((sum, record) => sum + record.amountReceived, 0);
  const remainingBalance = Math.max(0, milestone!.amount - amountPaid);
  duplicateReplay = {
    payment: {
      ...milestone!,
      amountPaid,
      remainingBalance,
      status: remainingBalance === 0 ? 'paid' : amountPaid > 0 ? 'partially_paid' : 'pending',
    },
    history: existingHistory,
  };
  return;
}

// at the top of write
if (duplicateReplay) return duplicateReplay;
if (!paymentDate) paymentDate = parseDate(input.paymentDate);

// at the top of sideEffects
if (duplicateReplay) return;
```

- [ ] Use `paymentDate` inside the transaction instead of parsing `input.paymentDate` a second time.
- [ ] Do not audit or enqueue notification for duplicate replay; the original payment record is the durable evidence.
- [ ] Add a second test proving a new reference number still creates a payment record and audits once:

```ts
it('records and audits a payment when the reference number is new', async () => {
  const { service, prisma, audit, history } = createPaymentService();

  const result = await service.recordPayment(
    'evt_sample',
    'pay_downpayment',
    {
      amountReceived: 25000,
      paymentDate: '2026-06-21',
      paymentMethod: 'Bank Transfer',
      referenceNumber: 'BNK-456',
    },
    { name: 'PMCM Admin', role: 'pmcm-admin', email: 'admin@pmcm.test' },
  );

  expect(prisma.opsPaymentRecord.create).toHaveBeenCalledTimes(1);
  expect(audit.audit).toHaveBeenCalledTimes(1);
  expect(history).toHaveLength(2);
  expect(result.amountPaid).toBe(50000);
  expect(result.remainingBalance).toBe(50000);
});
```
- [ ] Run `npm --workspace prism-api run test -- libs/modules/finance-ops/src/services/billing-operations.service.test.ts`.
  Expected: PASS, 2 tests.

## Task 6 - Wire Event-Ops Compatibility To Finance-Ops

- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.module.ts`:
  - Import `FinanceOpsModule` from `@prism/modules/finance-ops`.
  - Remove `BillingOperationsService` from local imports and `EVENT_OPS_PROVIDERS`.
  - Add `FinanceOpsModule` to module imports.
- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` to import `BillingOperationsService` from `@prism/modules/finance-ops`.
- [ ] Keep `EventOpsService` constructor injection unchanged so route compatibility stays stable.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/event-ops.service.test.ts`.
  Expected: PASS.

## Task 7 - Verification And Docs Closeout

- [ ] Run `npm --workspace prism-api run test -- libs/modules/finance-ops/src/services/billing-operations.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test:event-ops`.
- [ ] Run `npm --workspace prism-api run build`.
- [ ] Run `npm run check:boundaries`.
- [ ] Run `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/supplier-ops|modules/supplier-ops" apps/api/libs/modules/finance-ops`; expected result: no matches.
- [ ] Run `git diff --check`.
- [ ] Update parent Phase 5 checkboxes only for items proven by this slice. Leave read-model migration and supplier/guest read-payload hardening unchecked unless a test proves them.
- [ ] Add verification evidence to this child plan.
- [ ] Update `docs/prism-v4/15-system-architecture.md` and `docs/prism-v4/17-current-state-2026-06-20.md` with finance extraction state and remaining read-model dependency.
- [ ] Commit checkpoint: `refactor(api): extract finance operations module`.

## Acceptance Criteria

- [ ] `BillingOperationsService` lives under `finance-ops` and is provided/exported by `FinanceOpsModule`.
- [ ] Existing billing routes stay compatible through `EventOpsService`.
- [ ] Payment record replay with the same non-empty reference number does not duplicate payment records, milestone totals, or audit rows.
- [ ] Full event-ops tests, API build, boundary check, finance no-private-import scan, and diff check pass.
- [ ] No billing read-model, commercial proposal, file/document-vault, or controller behavior is moved accidentally.
- [ ] Remaining finance hardening is clear: dispute/waiver/correction/additional billing and read-model extraction need separate child plans.

## Stop Rules

Stop and revise before implementation if:

1. `FinanceOpsModule` cannot provide `BillingOperationsService` without importing `EventOpsModule`.
2. Moving billing forces moving `EventReadModelsService`, proposal/commercial workflow, file/document-vault, or controllers in the same phase.
3. Idempotency requires a database schema change to be correct for the chosen behavior.
4. Public route paths or required request fields must change.
5. Supplier/guest role leakage appears in billing payload tests.
6. Boundary checks require allowing `finance-ops` to import `event-ops` or `supplier-ops` internals.

## Self-Review

| Requirement | Coverage |
| --- | --- |
| Phase 5 finance extraction | Tasks 2-6 create `finance-ops`, move the service/test, and wire runtime ownership. |
| Command tests | Tasks 1 and 5 add payment mutation/idempotency tests. |
| Idempotency behavior | Task 5 defines duplicate replay behavior without a schema change. |
| Route compatibility | Task 6 keeps `EventOpsService` constructor and routes stable. |
| Read-model caution | Scope rules and Task 7 explicitly defer read-model movement. |
| Boundary safety | Task 7 checks no event-ops or supplier-ops imports inside finance-ops. |
| Docs alignment | Task 7 updates parent plan and Prism architecture/current-state docs. |
