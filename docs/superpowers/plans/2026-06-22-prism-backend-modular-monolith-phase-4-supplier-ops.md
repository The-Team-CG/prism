# Prism Backend Modular Monolith Phase 4 Supplier Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the first supplier workflow vertical slice into `supplier-ops` while preserving current event-ops HTTP routes and supplier portal behavior.

**Architecture:** Keep `event-ops` as the route compatibility facade. Move only `SupplierNetworkWorkflowService` and its direct unit test into `supplier-ops`; keep `SuppliersService`, PARE, live operations, document vault, commercial quote creation, and event read models in their current modules until separate child plans extract them. Supplier workflow code consumes cross-cutting infrastructure from `event-core`, `trust-ops`, and `access-control` through public exports.

**Tech Stack:** NestJS modules/providers, PrismaService, Vitest, TypeScript path aliases, existing event-ops service tests, and `scripts/check-prism-boundaries.mjs`.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Platform trust through the first business-capability extraction with route compatibility preserved. |
| Feature-ledger row | FL-007 supplier network operations, FL-014 notifications/audit side effects where supplier workflows record evidence, FL-022 supplier readiness board. |
| Route/app/actor | Existing supplier routes through `apps/api` event-ops controllers for PMCM and supplier actors. No route path changes. |
| Contract touched | Backend module exports and API TypeScript aliases only. No `packages/types` or `packages/api-client` changes unless a compile failure proves a compatibility export is required. |
| Fallback state | Existing sample-state and route compatibility stay unchanged. |
| Forbidden-role test | Existing event-ops supplier boundary tests must keep passing, including client/guest denial of PMCM-only supplier reads. |
| Query budget | Not applicable for this command extraction. Read models stay in `event-ops`. |
| Side-effect mode | Existing supplier workflow audit behavior is preserved; do not introduce new transaction semantics beyond existing `WorkflowCommandService` usage in this phase. |
| Route-smoke evidence | `npm --workspace prism-api run test -- libs/modules/supplier-ops/src/services/supplier-network-workflow.service.test.ts`, `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, `npm run check:boundaries`. |
| Docs updated | Parent Phase 4 checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md` after verification. |

## Scope Rules

In scope:

- Create `apps/api/libs/modules/supplier-ops`.
- Move `SupplierNetworkWorkflowService` and its unit test.
- Create `SupplierOpsModule` that provides and exports `SupplierNetworkWorkflowService`.
- Add public supplier ports/tokens for future extraction: `SUPPLIER_COMMANDS` and `SUPPLIER_READINESS_READER`.
- Wire `EventOpsModule` to import `SupplierOpsModule` and stop providing `SupplierNetworkWorkflowService` locally.
- Keep `event-ops/src/services/supplier-network-workflow.service.ts` as a compatibility re-export.

Out of scope:

- Moving `SuppliersService`, supplier directory mapping, supplier read models, supplier quote request creation, PARE, live operations, document vault, controllers, or API client contracts.
- Changing HTTP route paths, request/response shapes, database schema, production notifications, or storage behavior.

## Files To Create Or Move

| File | Purpose |
| --- | --- |
| `apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts` | Moved supplier workflow command owner. |
| `apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.test.ts` | Moved focused supplier workflow tests. |
| `apps/api/libs/modules/supplier-ops/src/supplier-ops.module.ts` | Provides and exports supplier workflow service and public tokens. |
| `apps/api/libs/modules/supplier-ops/src/ports/supplier-ops.tokens.ts` | `SUPPLIER_COMMANDS` and `SUPPLIER_READINESS_READER` tokens. |
| `apps/api/libs/modules/supplier-ops/src/ports/supplier-commands.port.ts` | Minimal command-port interface for extracted workflow methods used by `event-ops`. |
| `apps/api/libs/modules/supplier-ops/src/ports/supplier-readiness-reader.port.ts` | Minimal future reader-port placeholder for readiness reads; no implementation unless used in this phase. |
| `apps/api/libs/modules/supplier-ops/src/index.ts` | Public supplier-ops exports. |
| `apps/api/libs/modules/supplier-ops/tsconfig.lib.json` | Library tsconfig matching existing API module pattern. |
| `apps/api/libs/modules/event-ops/src/services/supplier-network-workflow.service.ts` | Compatibility re-export from `@prism/modules/supplier-ops`. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Imports `SupplierOpsModule`, removes local supplier workflow provider. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Imports supplier workflow service from public module alias for direct construction. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add `@prism/modules/supplier-ops` aliases and Nest metadata. |

## Task 1 - Create Supplier-Ops Module Shell

- [ ] Create `apps/api/libs/modules/supplier-ops/src/ports` and `src/services`.
- [ ] Add `apps/api/libs/modules/supplier-ops/tsconfig.lib.json` with the same shape as other API libs and `outDir` set to `../../../dist/libs/modules/supplier-ops`.
- [ ] Add `@prism/modules/supplier-ops` and `@prism/modules/supplier-ops/*` to `apps/api/tsconfig.json`.
- [ ] Add `@prism/modules/supplier-ops` to `apps/api/vitest.config.ts`.
- [ ] Add a `supplier-ops` project entry to `apps/api/nest-cli.json`.
- [ ] Commit checkpoint: `docs/build metadata included with supplier ops shell` only if this task is separated from the service move; otherwise commit with Task 2.

## Task 2 - Move Supplier Workflow Service

- [ ] `git mv apps/api/libs/modules/event-ops/src/services/supplier-network-workflow.service.ts apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts`.
- [ ] `git mv apps/api/libs/modules/event-ops/src/services/supplier-network-workflow.service.test.ts apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.test.ts`.
- [ ] Update moved service imports:
  - constants from `@prism/modules/event-core`.
  - `AuditService` from `@prism/modules/trust-ops`.
  - `EventAccessPolicyService` and `ResolvedEventOpsActor` from `@prism/modules/access-control`.
  - Keep `SuppliersService`, `LiveOperationsService`, `PAREService`, `DocumentVaultService`, and their types imported from `@prism/modules/event-ops/...` compatibility paths for this phase.
  - `WorkflowCommandService` from `@prism/modules/event-core`.
- [ ] Update moved test imports to use `@prism/modules/event-core` constants and `WorkflowCommandService`.
- [ ] Create `apps/api/libs/modules/event-ops/src/services/supplier-network-workflow.service.ts` as `export * from '@prism/modules/supplier-ops';`.

## Task 3 - Add Supplier Ports And Module

- [ ] Create `apps/api/libs/modules/supplier-ops/src/ports/supplier-ops.tokens.ts` with `SUPPLIER_COMMANDS` and `SUPPLIER_READINESS_READER` symbols.
- [ ] Create `supplier-commands.port.ts` with an interface covering the moved service methods currently delegated by `EventOpsService`: create/update supplier profile, tier/review/certification, confirm/withdraw/readiness/status/contract/verification workflows.
- [ ] Create `supplier-readiness-reader.port.ts` with a minimal `SupplierReadinessReader` interface for future read-model extraction; do not implement it unless a current constructor needs it.
- [ ] Create `SupplierOpsModule` that imports `DatabaseModule`, `EventCoreModule`, `TrustOpsModule`, `AccessControlModule`, and `EventOpsModule` dependencies must be avoided. If the moved service still needs `SuppliersService`, `LiveOperationsService`, `PAREService`, or `DocumentVaultService`, inject them from `event-ops` compatibility only after confirming this does not create a circular Nest module import. Prefer leaving this module without Nest import into event-ops until Task 4 resolves wiring.
- [ ] Create `apps/api/libs/modules/supplier-ops/src/index.ts` exporting module, ports, tokens, and service.

## Task 4 - Wire Event-Ops Compatibility

- [ ] Update `EventOpsModule` to import `SupplierOpsModule` only if it can do so without circular imports. If the moved service still depends on local `event-ops` services, keep `SupplierNetworkWorkflowService` as a local provider through the compatibility re-export and document that full Nest ownership is deferred to the next supplier child plan.
- [ ] Update `event-ops.service.test.ts` to import `SupplierNetworkWorkflowService` from `@prism/modules/supplier-ops` if direct construction still works.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/supplier-ops/src/services/supplier-network-workflow.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/event-ops.service.test.ts`.
- [ ] Commit checkpoint: `refactor(api): extract supplier operations module`.

## Task 5 - Full Verification And Docs Closeout

- [ ] Run `npm --workspace prism-api run test -- libs/modules/supplier-ops/src/services/supplier-network-workflow.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test:event-ops`.
- [ ] Run `npm --workspace prism-api run build`.
- [ ] Run `npm run check:boundaries`.
- [ ] Run `rg -n "@prism/modules/event-ops|modules/event-ops" apps/api/libs/modules/supplier-ops`; expected result is no matches unless the child plan records a deliberate compatibility exception for `SuppliersService`, `LiveOperationsService`, `PAREService`, or `DocumentVaultService`.
- [ ] Run `git diff --check`.
- [ ] Update parent Phase 4 checkboxes only after verification passes.
- [ ] Add verification evidence to this child plan.
- [ ] Update architecture/current-state docs with the supplier extraction state and any deferred compatibility exception.
- [ ] Commit checkpoint: `docs: close phase 4 supplier operations extraction`.

## Acceptance Criteria

- [ ] Supplier workflow command ownership is separated from the `event-ops` services folder or a documented compatibility exception explains why Nest provider ownership is deferred.
- [ ] Existing API routes remain compatible.
- [ ] Supplier workflow focused tests pass in the new module path.
- [ ] Full event-ops tests, API build, boundary check, and diff check pass.
- [ ] No supplier read-model or supplier directory behavior is moved accidentally.
- [ ] The next extraction dependency is clear: `SuppliersService` and read-model ports must be separated before supplier-ops can be fully independent.

## Stop Rules

Stop and revise before implementation if:

1. `SupplierOpsModule` requires importing `EventOpsModule`, creating a circular runtime module dependency.
2. Moving `SupplierNetworkWorkflowService` forces moving PARE, live operations, document vault, commercial quote creation, or read models in the same phase.
3. Route contracts or shared API client types must change.
4. Boundary checks reject supplier-ops compatibility imports and there is no narrow exception to document.
5. Supplier portal or PMCM supplier tests require broad fixture rewrites before behavior can be preserved.

## Self-Review

- Spec coverage: Covers Phase 4 master-plan goals while explicitly limiting the first vertical slice.
- Placeholder scan: No placeholder markers or unspecified tests are intentionally left in this plan.
- Type consistency: Service, module, port, and token names match the parent plan naming standard.