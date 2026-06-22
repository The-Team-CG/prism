# Prism Backend Modular Monolith Phase 7B Commercial Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Extract supplier quote request, quote submission/revision, quote selection, and quote-request read behavior into `commercial-ops` while preserving existing event and supplier quote route contracts.

**Architecture:** `commercial-ops` owns the current commercial workflow represented in code by supplier quote requests and quote decisions. The module provides `CommercialWorkflowService`, a local Prisma-backed quote-supplier resolver, and public command/reader tokens. `event-ops` remains the route facade; controller moves, proposal document generation, and cross-domain read-model extraction remain separate phases.

**Tech Stack:** NestJS modules/providers, PrismaService, Vitest, TypeScript path aliases, existing `event-ops` compatibility facade, `@prism/modules/event-core`, `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, `@prism/database`, and current event-ops route tests.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Stable backend ownership for commercial quote workflow so redesign work can rely on route-compatible supplier quote request, supplier quote, and PMCM selection behavior. |
| Feature-ledger row | FL-007 supplier quote request workflow, FL-008 confidential supplier bidding, FL-009 quote revision/selection, FL-010 proposal/commercial readiness. |
| Route/app/actor | Existing event routes for PMCM quote requests and quote selection plus supplier quote-request token routes. PMCM requests/selects quotes; suppliers submit/revise through token-scoped routes. |
| Contract touched | Backend module exports and API TypeScript aliases. No `packages/types` or `packages/api-client` changes unless build proves a compatibility export is missing. |
| Fallback state | Existing `event-ops` route facade stays. Proposal document generation and briefing/commercial read-model composition remain deferred. |
| Forbidden-role test | Existing event-ops tests for supplier-scoped quote workspace/privacy keep passing. Added event-ops compatibility coverage that supplier and guest actors cannot create quote requests, add PMCM quote details, or select supplier quotes. |
| Query budget | Quote request creation performs event lookup, category lookup, supplier selection, active duplicate request scan, then one transaction that creates one row per selected supplier. Token read performs one request lookup, optional expiry update, one event lookup, and one latest quote lookup. |
| Side-effect mode | Quote request, quote creation/revision, and selection use the existing `WorkflowCommandService` boundary: DB writes first, then audit/outbox side effects. Multi-row quote request and selection writes stay inside Prisma transactions. Token lookup is read-mostly, with an expiry status update when overdue. |
| Route-smoke evidence | `npm --workspace prism-api run test -- libs/modules/commercial-ops/src/services/commercial-workflow.service.test.ts`, `npm --workspace prism-api run test -- commercial quote`, `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, `npm run check:boundaries`. |
| Docs updated | Parent Phase 7B checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## Current Findings

- `CommercialWorkflowService` owns `requestSupplierQuotes`, `addSupplierQuote`, `getQuoteRequestByToken`, `submitSupplierQuoteByToken`, `reviseSupplierQuoteByToken`, and `selectSupplierQuote`.
- The service currently depends on `SuppliersService.resolveQuoteSupplier`. A provider inside `CommercialOpsModule` cannot depend on an `EventOpsModule` provider, so this phase adds a local `PrismaQuoteSupplierResolver` that implements only the quote supplier resolution behavior needed by commercial workflows.
- Existing `event-ops.service.test.ts` covers confidential quote requests, duplicate active quote prevention, supplier quote submission/revision, quote selection, and supplier-scoped workspace privacy.
- Existing `commercial-workflow.service.test.ts` covers overdue quote-request token expiry and can move with the service.

## Scope Rules

In scope:

- Create `apps/api/libs/modules/commercial-ops`.
- Move `CommercialWorkflowService` and its focused test into `commercial-ops`.
- Add `CommercialOpsModule` that provides/exports `CommercialWorkflowService`, `COMMERCIAL_WORKFLOW_COMMANDS`, `PROPOSAL_READER`, and `QUOTE_SUPPLIER_RESOLVER`.
- Add public ports: `CommercialWorkflowCommands`, `ProposalReader`, and `QuoteSupplierResolver`.
- Add `PrismaQuoteSupplierResolver` to replace the private `SuppliersService.resolveQuoteSupplier` dependency.
- Keep `event-ops` compatibility re-export at the old service path.
- Update `EventOpsModule`, `EventOpsService`, and `event-ops.service.test.ts` to import commercial behavior from `@prism/modules/commercial-ops`.
- Preserve public route paths and response mapping.
- Add optional sample actor query handling to PMCM commercial route facade methods so supplier/guest actors are denied while existing callers keep PMCM defaults.

Out of scope:

- Moving controllers.
- Moving supplier directory ownership.
- Moving billing/proposal document generation.
- Creating real proposal documents or API client contract changes.
- Extracting read models or adding external notification delivery.

## Files To Create Or Move

| File | Purpose |
| --- | --- |
| `apps/api/libs/modules/commercial-ops/src/services/commercial-workflow.service.ts` | Moved commercial quote workflow owner. |
| `apps/api/libs/modules/commercial-ops/src/services/commercial-workflow.service.test.ts` | Focused commercial workflow tests. |
| `apps/api/libs/modules/commercial-ops/src/services/prisma-quote-supplier-resolver.service.ts` | Local resolver for quote supplier selection without importing `event-ops`. |
| `apps/api/libs/modules/commercial-ops/src/ports/commercial-ops.tokens.ts` | `COMMERCIAL_WORKFLOW_COMMANDS`, `PROPOSAL_READER`, `QUOTE_SUPPLIER_RESOLVER` tokens. |
| `apps/api/libs/modules/commercial-ops/src/ports/commercial-workflow-commands.port.ts` | Public commercial command interface and `AddSupplierQuoteInput`. |
| `apps/api/libs/modules/commercial-ops/src/ports/proposal-reader.port.ts` | Public token-scoped quote/proposal read interface. |
| `apps/api/libs/modules/commercial-ops/src/ports/quote-supplier-resolver.port.ts` | Resolver interface used by `CommercialWorkflowService`. |
| `apps/api/libs/modules/commercial-ops/src/commercial-ops.module.ts` | Runtime module. |
| `apps/api/libs/modules/commercial-ops/src/index.ts` | Public exports. |
| `apps/api/libs/modules/commercial-ops/tsconfig.lib.json` | Library tsconfig. |
| `apps/api/libs/modules/event-ops/src/services/commercial-workflow.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import `CommercialOpsModule`; remove local commercial provider. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Import moved service/types from commercial-ops. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Import moved service from commercial-ops. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add commercial-ops aliases and Nest metadata. |

## Task 1 - Strengthen Focused Commercial Tests Before Moving

- [x] Extend `apps/api/libs/modules/event-ops/src/services/commercial-workflow.service.test.ts` with a second test that verifies quote selection marks competing quotes and requests correctly. Use the existing file and append this test case:

```ts
  it('selects one quote, closes competing requests, and queues PMCM side effects', async () => {
    const quotes = [
      {
        id: 'quote_selected',
        eventId: 'evt_sample',
        requestId: 'qr_selected',
        supplierName: 'Sonic Line Events',
        category: 'Technicals',
        categoryId: 'cat_tech',
        status: 'received',
      },
      {
        id: 'quote_other',
        eventId: 'evt_sample',
        requestId: 'qr_other',
        supplierName: 'Backup AV',
        category: 'Technicals',
        categoryId: 'cat_tech',
        status: 'received',
      },
    ];
    const quoteRequests = [
      { id: 'qr_selected', eventId: 'evt_sample', categoryId: 'cat_tech', status: 'submitted' },
      { id: 'qr_other', eventId: 'evt_sample', categoryId: 'cat_tech', status: 'submitted' },
    ];
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_sample' })) },
      opsSupplierQuote: {
        findUnique: vi.fn(async ({ where }) => quotes.find((quote) => quote.id === where.id) ?? null),
        updateMany: vi.fn(async ({ where, data }) => {
          for (const quote of quotes) {
            if (quote.eventId === where.eventId && quote.category === where.category && quote.id !== where.id.not) {
              Object.assign(quote, data);
            }
          }
          return { count: 1 };
        }),
        update: vi.fn(async ({ where, data }) => {
          const quote = quotes.find((item) => item.id === where.id)!;
          Object.assign(quote, data);
          return quote;
        }),
      },
      opsSupplierQuoteRequest: {
        update: vi.fn(async ({ where, data }) => {
          const request = quoteRequests.find((item) => item.id === where.id)!;
          Object.assign(request, data);
          return request;
        }),
        updateMany: vi.fn(async ({ where, data }) => {
          for (const request of quoteRequests) {
            if (request.eventId === where.eventId && request.categoryId === where.categoryId && request.id !== where.id.not) {
              Object.assign(request, data);
            }
          }
          return { count: 1 };
        }),
      },
      $transaction: vi.fn(async (callback) => callback(prisma)),
    };
    const auditService = { audit: vi.fn(async () => undefined) };
    const notificationOutboxService = { queue: vi.fn(async () => undefined) };
    const service = new CommercialWorkflowService(
      prisma as any,
      auditService as any,
      notificationOutboxService as any,
      new WorkflowCommandService(),
      { resolveQuoteSupplier: vi.fn() } as any,
    );

    const selected = await service.selectSupplierQuote('evt_sample', 'quote_selected');

    expect(selected.status).toBe('selected');
    expect(quotes.find((quote) => quote.id === 'quote_other')?.status).toBe('not_selected');
    expect(quoteRequests.find((request) => request.id === 'qr_selected')?.status).toBe('selected');
    expect(quoteRequests.find((request) => request.id === 'qr_other')?.status).toBe('closed');
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_sample',
      'PMCM Admin',
      'Selected supplier quote: Sonic Line Events',
      expect.objectContaining({ affectedType: 'supplier_quote' }),
    );
    expect(notificationOutboxService.queue).toHaveBeenCalledWith(
      'evt_sample',
      'Sonic Line Events',
      'Your supplier quote was selected',
    );
  });
```

- [x] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/commercial-workflow.service.test.ts`.
  Expected before move: PASS.

## Task 2 - Create Commercial-Ops Module Shell

- [x] Create directories `apps/api/libs/modules/commercial-ops/src/ports` and `apps/api/libs/modules/commercial-ops/src/services`.
- [x] Add aliases and Nest metadata for `@prism/modules/commercial-ops` in `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, and `apps/api/nest-cli.json`.
- [x] Create `commercial-ops.tokens.ts`, `commercial-workflow-commands.port.ts`, `proposal-reader.port.ts`, `quote-supplier-resolver.port.ts`, `commercial-ops.module.ts`, `index.ts`, and `tsconfig.lib.json` using the same module style as `finance-ops` and `inquiry-onboarding`.

## Task 3 - Move Commercial Workflow And Add Resolver

- [x] Move `CommercialWorkflowService` and its test into `commercial-ops`.
- [x] Replace old service path with `export * from '@prism/modules/commercial-ops';`.
- [x] Update moved service imports to use `@prism/modules/event-core`, `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, and `QuoteSupplierResolver` from the new port.
- [x] Add `PrismaQuoteSupplierResolver` that implements the old `resolveQuoteSupplier` behavior with Prisma and `SupplierTier.Tier1` from `@prism/modules/event-core`.

## Task 4 - Wire Event-Ops Compatibility

- [x] Update `EventOpsModule` to import `CommercialOpsModule`, remove `CommercialWorkflowService` from local providers, and import the class from `@prism/modules/commercial-ops`.
- [x] Update `EventOpsService` to import `CommercialWorkflowService`, `RequestSupplierQuotesInput`, `SubmitSupplierQuoteInput`, and `AddSupplierQuoteInput` from `@prism/modules/commercial-ops`.
- [x] Update `event-ops.service.test.ts` to import `CommercialWorkflowService` from `@prism/modules/commercial-ops`.

## Task 5 - Commercial Facade Role Hardening

- [x] Add optional `SampleActorDto` query handling to PMCM commercial facade routes for quote creation, quote request creation, and quote selection.
- [x] Require PMCM/system role before `EventOpsService` delegates PMCM commercial proposal decisions to `CommercialWorkflowService`.
- [x] Add event-ops compatibility regression coverage that supplier and guest actors are denied before quote request, quote detail, or quote selection writes run.
- [x] Run `npm --workspace prism-api run test -- event-ops.service.test.ts`.

## Task 6 - Verification And Docs Closeout

- [x] Run `npm --workspace prism-api run test -- libs/modules/commercial-ops/src/services/commercial-workflow.service.test.ts`.
- [x] Run `npm --workspace prism-api run test -- commercial quote`.
- [x] Run `npm --workspace prism-api run test:event-ops`.
- [x] Run `npm --workspace prism-api run build`.
- [x] Run `npm run check:boundaries`.
- [x] Run `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/finance-ops|modules/finance-ops|@prism/modules/supplier-ops|modules/supplier-ops|@prism/modules/file-ops|modules/file-ops|@prism/modules/inquiry-onboarding|modules/inquiry-onboarding" apps/api/libs/modules/commercial-ops`; expected result: no matches.
- [x] Run `git diff --check`.
- [x] Update parent Phase 7B checklist only for items proven by this slice.
- [x] Add verification evidence to this child plan.
- [x] Update `docs/prism-v4/15-system-architecture.md` and `docs/prism-v4/17-current-state-2026-06-20.md`.
- [x] Commit checkpoint: `refactor(api): extract commercial operations module`.
- [x] Commit checkpoint: `test(api): harden commercial facade role checks`.

## Acceptance Criteria

- [x] `CommercialWorkflowService` lives under `commercial-ops` and is provided/exported by `CommercialOpsModule`.
- [x] `CommercialWorkflowService` no longer imports `SuppliersService` or any private `event-ops` service.
- [x] `PrismaQuoteSupplierResolver` preserves supplier resolution for manual PMCM quote entry.
- [x] Quote request, supplier token submission/revision, quote selection, and token expiry tests pass.
- [x] Existing route behavior remains reachable through `EventOpsService` compatibility methods.
- [x] `commercial-ops` has no forbidden imports to event-ops, supplier-ops, finance-ops, file-ops, or inquiry-onboarding internals.
- [x] API build, event-ops compatibility tests, boundary check, no-private-import scan, and diff check pass.

## Verification Evidence

| Command | Result |
| --- | --- |
| `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/commercial-workflow.service.test.ts` | Passed before move: 1 file, 2 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run test -- libs/modules/commercial-ops/src/services/commercial-workflow.service.test.ts` | Passed after move: 1 file, 2 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run test -- commercial quote` | Passed: 1 file, 2 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run test:event-ops` | Passed: 10 files, 84 tests. The event-ops focused commercial test moved into commercial-ops, which explains the lower event-ops count. |
| `npm --workspace prism-api run test -- event-ops.service.test.ts` | Passed after role-hardening patch: 1 file, 62 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run build` | Passed after role-hardening patch. Initial sandbox run failed on `dist` unlink `EPERM`; escalated rerun passed. |
| `npm run check:boundaries` | Passed for 494 files after role-hardening patch. Initial sandbox run failed on `spawnSync git EPERM`; escalated rerun passed. |
| `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/finance-ops|modules/finance-ops|@prism/modules/supplier-ops|modules/supplier-ops|@prism/modules/file-ops|modules/file-ops|@prism/modules/inquiry-onboarding|modules/inquiry-onboarding" apps/api/libs/modules/commercial-ops` | Passed with no matches; `rg` exited 1 as expected for no results. |
| `git diff --check` | Passed; remaining output was line-ending normalization warnings only. |

## Implementation Notes

- `CommercialWorkflowService` now lives under `apps/api/libs/modules/commercial-ops/src/services` and is provided/exported by `CommercialOpsModule`.
- `CommercialOpsModule` exports `COMMERCIAL_WORKFLOW_COMMANDS`, `PROPOSAL_READER`, and `QUOTE_SUPPLIER_RESOLVER`.
- `PrismaQuoteSupplierResolver` preserves the old manual quote supplier resolution behavior without importing `SuppliersService` or `event-ops` internals.
- The old `event-ops` commercial workflow path is a one-line compatibility re-export.
- `EventOpsModule` imports `CommercialOpsModule`; it no longer provides `CommercialWorkflowService` locally.
- Existing event and supplier quote routes continue through `EventOpsService` compatibility methods; PMCM commercial decision methods now accept optional actor query context and reject supplier/guest actors before writes.
- Remaining commercial hardening is separate: controller moves, full proposal document generation, briefing reader ownership, and a dedicated proposal-document route smoke after that endpoint exists. Supplier/guest denial for current PMCM commercial proposal decisions is now covered.

## Stop Rules

Stop and revise before implementation if:

1. `CommercialOpsModule` cannot provide `CommercialWorkflowService` without importing `EventOpsModule`.
2. Moving commercial behavior forces public route path or DTO changes.
3. Commercial workflow needs to import private `event-ops` services.
4. Supplier directory ownership must move in the same branch.
5. Billing/proposal generation must be rewritten to complete this extraction.
6. Supplier quote token routes leak confidential client fields in tests.

## Self-Review

| Requirement | Coverage |
| --- | --- |
| Phase 7B child plan exists before implementation | This plan separates commercial-ops from inquiry and compliance work. |
| Owner D evidence gate | Evidence table includes owner goal, feature rows, route/actor, contracts, fallback, forbidden-role coverage, query budget, side effects, route smoke, and docs. |
| Provider feasibility | The local quote-supplier resolver avoids a dependency from commercial-ops back to event-ops. |
| Public ports | Task 2 adds command, reader, and resolver tokens/interfaces. |
| Verification | Task 5 covers focused tests, route compatibility, build, boundaries, private import scan, and diff check. |
