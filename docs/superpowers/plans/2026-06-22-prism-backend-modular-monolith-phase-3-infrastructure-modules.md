# Prism Backend Modular Monolith Phase 3 Infrastructure Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract Prism cross-cutting backend services from the legacy `event-ops` folder into first-class `event-core`, `trust-ops`, `notification-ops`, and `access-control` modules without changing public HTTP routes or shared app contracts.

**Architecture:** Keep one NestJS API and one Prisma client. Move workflow command execution, shared operation constants, audit/privacy, notification outbox, and access policy behind public module exports and provider tokens; `event-ops` remains the compatibility facade. No supplier, billing, floorplan, closure, dashboard, guest, file, inquiry, storage, auth-provider, live-AI, QR/camera, or production notification behavior moves in this phase.

**Tech Stack:** NestJS modules/providers, PrismaService, TypeScript path aliases, Vitest direct-construction tests, existing `npm --workspace prism-api` scripts, and `scripts/check-prism-boundaries.mjs`.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Platform trust through first-class cross-cutting modules and stable provider contracts. |
| Feature-ledger row | FL-014 notifications, FL-015 security/privacy/audit, FL-008 coordinator side-effect evidence, and shared backend support for role-safe PMCM operations. |
| Route/app/actor | Existing `apps/api` event-ops routes for PMCM, coordinator, client, supplier, and guest actors. No public route path changes. |
| Contract touched | Backend module exports and API TypeScript aliases only. `packages/types` and `packages/api-client` remain unchanged. |
| Fallback state | `/api/sample/state` remains compatibility-only. No fallback removal. |
| Forbidden-role test | Existing event access policy tests and the full event-ops suite must keep passing. |
| Query budget | Not applicable; no read-model query code is added. |
| Side-effect mode | Existing `same_tx` coordinator command behavior from Phase 2 must keep passing through moved ports. |
| Route-smoke evidence | `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, and `npm run check:boundaries`. |
| Docs updated | Parent Phase 3 checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## Design Decision

Move `ops.constants.ts` to `event-core` first. Otherwise `trust-ops`, `notification-ops`, and `access-control` would need to import constants from `event-ops`, which violates the Phase 0 guardrail that capability modules must not import the compatibility hub.

Keep compatibility re-export files under `event-ops` during this phase. Existing imports can continue to compile while new modules consume public exports from the owning modules.

## Files To Create Or Move

| Target | Source or purpose |
| --- | --- |
| `apps/api/libs/modules/event-core/src/ops.constants.ts` | Move from `event-ops/src/ops.constants.ts`. |
| `apps/api/libs/modules/event-core/src/services/workflow-command.service.ts` | Move from `event-ops/src/services/workflow-command.service.ts`. |
| `apps/api/libs/modules/event-core/src/services/workflow-command.service.test.ts` | Move from `event-ops/src/services/workflow-command.service.test.ts`. |
| `apps/api/libs/modules/event-core/src/event-core.module.ts` | Provides `WorkflowCommandService`, `PrismTransactionRunner`, and `WORKFLOW_COMMAND_LOG`. |
| `apps/api/libs/modules/event-core/src/ports/workflow-command-log.tokens.ts` | Public event-core token. |
| `apps/api/libs/modules/trust-ops/src/services/audit.service.ts` | Move from `event-ops/src/services/audit.service.ts`. |
| `apps/api/libs/modules/trust-ops/src/services/privacy-operations.service.ts` | Move from `event-ops/src/services/privacy-operations.service.ts`. |
| `apps/api/libs/modules/trust-ops/src/ports/*` | Move audit writer port, adapter, and token. |
| `apps/api/libs/modules/trust-ops/src/trust-ops.module.ts` | Provides audit/privacy services and `AUDIT_WRITER`. |
| `apps/api/libs/modules/notification-ops/src/services/notification-outbox.service.ts` | Move from `event-ops/src/services/notification-outbox.service.ts`. |
| `apps/api/libs/modules/notification-ops/src/ports/*` | Move notification writer port, adapter, and token. |
| `apps/api/libs/modules/notification-ops/src/notification-ops.module.ts` | Provides notification outbox service and `NOTIFICATION_OUTBOX_WRITER`. |
| `apps/api/libs/modules/access-control/src/services/event-access-policy.service.ts` | Move from `event-ops/src/services/event-access-policy.service.ts`. |
| `apps/api/libs/modules/access-control/src/ports/access-control.tokens.ts` | Move access-control token. |
| `apps/api/libs/modules/access-control/src/access-control.module.ts` | Provides event access policy and `EVENT_ACCESS_POLICY`. |
| `apps/api/libs/modules/*/src/index.ts` | Public barrels for each new module. |
| `apps/api/libs/modules/*/tsconfig.lib.json` | Library tsconfig files matching existing module pattern. |
| `apps/api/libs/modules/event-ops/src/ops.constants.ts` | Compatibility re-export from `@prism/modules/event-core`. |
| `apps/api/libs/modules/event-ops/src/services/{audit,privacy-operations,event-access-policy,notification-outbox,workflow-command}.service.ts` | Compatibility re-exports from owning modules while imports are migrated. |
| `apps/api/libs/modules/event-ops/src/ports/*.ts` | Compatibility re-exports from owning modules while imports are migrated. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add aliases and Nest library metadata. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import infrastructure modules and remove moved providers from local provider list. |
| `docs/prism-v4/15-system-architecture.md`, `docs/prism-v4/17-current-state-2026-06-20.md` | Record verified Phase 3 state. |

## Task 1 - Extract Event-Core Foundation

- [ ] Create `apps/api/libs/modules/event-core/src`, `ports`, and `services` directories.
- [ ] `git mv apps/api/libs/modules/event-ops/src/ops.constants.ts apps/api/libs/modules/event-core/src/ops.constants.ts`.
- [ ] `git mv apps/api/libs/modules/event-ops/src/services/workflow-command.service.ts apps/api/libs/modules/event-core/src/services/workflow-command.service.ts`.
- [ ] `git mv apps/api/libs/modules/event-ops/src/services/workflow-command.service.test.ts apps/api/libs/modules/event-core/src/services/workflow-command.service.test.ts`.
- [ ] Create `apps/api/libs/modules/event-core/src/ports/workflow-command-log.tokens.ts` with `export const WORKFLOW_COMMAND_LOG = Symbol.for('prism.eventCore.workflowCommandLog');`.
- [ ] Create `EventCoreModule` that imports `DatabaseModule`, provides `PrismTransactionRunner`, `WorkflowCommandService`, and a `{ provide: WORKFLOW_COMMAND_LOG, useExisting: WorkflowCommandService }` provider, and exports all three provider entries.
- [ ] Create `apps/api/libs/modules/event-core/src/index.ts` exporting the module, constants, workflow token, and workflow command service.
- [ ] Recreate `apps/api/libs/modules/event-ops/src/ops.constants.ts` as `export * from '@prism/modules/event-core';`.
- [ ] Update moved workflow service and test shared-kernel relative imports to `../../../../core/shared-kernel/src`.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-core/src/services/workflow-command.service.test.ts`.
- [ ] Commit checkpoint: `refactor(api): create event core module`.

## Task 2 - Extract Notification-Ops

- [ ] Create `apps/api/libs/modules/notification-ops/src`, `ports`, and `services` directories.
- [ ] Move `notification-outbox.service.ts`, `notification-outbox.service.test.ts`, `notification-ops.tokens.ts`, `notification-outbox-writer.port.ts`, and `notification-outbox-writer.adapter.ts` from `event-ops` to `notification-ops` with `git mv`.
- [ ] Update moved notification imports so `NotificationChannel` comes from `@prism/modules/event-core` and `PrismTransactionContext` comes from `../../../../core/shared-kernel/src`.
- [ ] Create `NotificationOpsModule` that imports `DatabaseModule`, provides `NotificationOutboxService`, `NotificationOutboxWriterAdapter`, and `{ provide: NOTIFICATION_OUTBOX_WRITER, useExisting: NotificationOutboxWriterAdapter }`, and exports those provider entries.
- [ ] Create `apps/api/libs/modules/notification-ops/src/index.ts` exporting the module, token, port, adapter, and service.
- [ ] Recreate the moved `event-ops/src/ports/notification*.ts` files as `export * from '@prism/modules/notification-ops';` compatibility shims.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/notification-ops/src/services/notification-outbox.service.test.ts`.
- [ ] Commit checkpoint: `refactor(api): extract notification operations module`.

## Task 3 - Extract Trust-Ops

- [ ] Create `apps/api/libs/modules/trust-ops/src`, `ports`, and `services` directories.
- [ ] Move `audit.service.ts`, `audit.service.test.ts`, `privacy-operations.service.ts`, `trust-ops.tokens.ts`, `audit-writer.port.ts`, and `audit-writer.adapter.ts` from `event-ops` to `trust-ops` with `git mv`.
- [ ] Update moved trust imports so audit/privacy constants come from `@prism/modules/event-core` and `AuditService` local imports use `./audit.service`.
- [ ] Create `TrustOpsModule` that imports `DatabaseModule`, provides `AuditService`, `PrivacyOperationsService`, `AuditWriterAdapter`, and `{ provide: AUDIT_WRITER, useExisting: AuditWriterAdapter }`, and exports those provider entries.
- [ ] Create `apps/api/libs/modules/trust-ops/src/index.ts` exporting the module, audit writer token/port/adapter, `AuditService`, and `PrivacyOperationsService`.
- [ ] Recreate moved `event-ops/src/services/audit.service.ts`, `privacy-operations.service.ts`, and audit/trust port files as `export * from '@prism/modules/trust-ops';` compatibility shims.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/trust-ops/src/services/audit.service.test.ts`.
- [ ] Commit checkpoint: `refactor(api): extract trust operations module`.

## Task 4 - Extract Access-Control

- [ ] Create `apps/api/libs/modules/access-control/src`, `ports`, and `services` directories.
- [ ] Move `event-access-policy.service.ts`, `event-access-policy.service.test.ts`, and `access-control.tokens.ts` from `event-ops` to `access-control` with `git mv`.
- [ ] Update moved access policy imports so constants come from `@prism/modules/event-core` and `AuditService` comes from `@prism/modules/trust-ops`.
- [ ] Create `AccessControlModule` that imports `TrustOpsModule`, provides `EventAccessPolicyService` and `{ provide: EVENT_ACCESS_POLICY, useExisting: EventAccessPolicyService }`, and exports both provider entries.
- [ ] Create `apps/api/libs/modules/access-control/src/index.ts` exporting the module, token, and `EventAccessPolicyService`.
- [ ] Recreate moved `event-ops/src/services/event-access-policy.service.ts` and access-control token files as `export * from '@prism/modules/access-control';` compatibility shims.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/access-control/src/services/event-access-policy.service.test.ts`.
- [ ] Commit checkpoint: `refactor(api): extract access control module`.

## Task 5 - Wire API Metadata And Event-Ops

- [ ] Add `@prism/modules/event-core`, `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, and `@prism/modules/access-control` path aliases plus wildcard aliases to `apps/api/tsconfig.json`.
- [ ] Add matching aliases to `apps/api/vitest.config.ts`.
- [ ] Add `event-core`, `trust-ops`, `notification-ops`, and `access-control` project entries to `apps/api/nest-cli.json` using the existing library project shape.
- [ ] Add `tsconfig.lib.json` for each new module with `extends: ../../../tsconfig.json`, `include: ["src/**/*"]`, and an `outDir` under `../../../dist/libs/modules/<module-name>`.
- [ ] Update `event-ops.module.ts` to import `EventCoreModule`, `TrustOpsModule`, `NotificationOpsModule`, and `AccessControlModule`.
- [ ] Remove moved local providers from `EVENT_OPS_PROVIDERS`: `AuditService`, `PrivacyOperationsService`, `NotificationOutboxService`, `PrismTransactionRunner`, `WorkflowCommandService`, `EventAccessPolicyService`, adapters, and token provider constants.
- [ ] Update direct-construction tests, especially `event-ops.service.test.ts`, to import moved service classes and adapters from public module aliases.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/event-ops.service.test.ts`.
- [ ] Commit checkpoint: `refactor(api): wire event ops to infrastructure modules`.

## Task 6 - Full Verification And Docs Closeout

- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-core/src/services/workflow-command.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/notification-ops/src/services/notification-outbox.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/trust-ops/src/services/audit.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/access-control/src/services/event-access-policy.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test:event-ops`.
- [ ] Run `npm --workspace prism-api run build`.
- [ ] Run `npm run check:boundaries`.
- [ ] Run `rg -n "@prism/modules/event-ops|modules/event-ops" apps/api/libs/modules/event-core apps/api/libs/modules/trust-ops apps/api/libs/modules/notification-ops apps/api/libs/modules/access-control`; expected result is no matches.
- [ ] Run `rg -n "BillingOperationsService|SupplierNetworkWorkflowService|FloorPlanWorkflowService|EventClosureService|EventReadModelsService|GuestWorkflowService|FileRequirementsMatrixService|InquiriesService" apps/api/libs/modules/event-core`; expected result is no matches.
- [ ] Run `git diff --check`.
- [ ] Update parent Phase 3 checkboxes only after all verification commands pass.
- [ ] Add verification evidence to this child plan with exact command names and pass results.
- [ ] Update `docs/prism-v4/15-system-architecture.md` to say Phase 3 infrastructure modules are active and `event-ops` remains route compatibility only.
- [ ] Update `docs/prism-v4/17-current-state-2026-06-20.md` with a post-snapshot Phase 3 note stating no capability modules were extracted.
- [ ] Commit checkpoint: `docs: close phase 3 backend infrastructure modules`.

## Verification Commands

```powershell
npm --workspace prism-api run test -- libs/modules/event-core/src/services/workflow-command.service.test.ts
npm --workspace prism-api run test -- libs/modules/notification-ops/src/services/notification-outbox.service.test.ts
npm --workspace prism-api run test -- libs/modules/trust-ops/src/services/audit.service.test.ts
npm --workspace prism-api run test -- libs/modules/access-control/src/services/event-access-policy.service.test.ts
npm --workspace prism-api run test -- libs/modules/event-ops/src/event-ops.service.test.ts
npm --workspace prism-api run test:event-ops
npm --workspace prism-api run build
npm run check:boundaries
rg -n "@prism/modules/event-ops|modules/event-ops" apps/api/libs/modules/event-core apps/api/libs/modules/trust-ops apps/api/libs/modules/notification-ops apps/api/libs/modules/access-control
rg -n "BillingOperationsService|SupplierNetworkWorkflowService|FloorPlanWorkflowService|EventClosureService|EventReadModelsService|GuestWorkflowService|FileRequirementsMatrixService|InquiriesService" apps/api/libs/modules/event-core
git diff --check
```

## Acceptance Criteria

- [ ] New infrastructure modules compile through the workspace build.
- [ ] `event-ops` imports cross-cutting behavior through public module exports or provider tokens.
- [ ] `event-ops` still owns compatibility routes and non-cross-cutting workflow services.
- [ ] No infrastructure module imports `event-ops`.
- [ ] `event-core` remains narrow and does not absorb closure, billing, supplier, floorplan, dashboard, file, guest, inquiry, or read-model behavior.
- [ ] Existing event-ops tests still pass.
- [ ] API build, boundary check, and diff check pass.
- [ ] Parent and child plans plus architecture/current-state docs are updated after verification.

## Stop Rules

Stop and revise before implementation continues if:

1. Moving constants into `event-core` creates app contract changes outside `apps/api`.
2. Any new infrastructure module needs to import `@prism/modules/event-ops` or private `event-ops/src/services/*` paths.
3. `event-core` begins absorbing closure, billing, supplier, floorplan, dashboard, file, guest, inquiry, or read-model behavior.
4. Public HTTP paths or DTO shapes need to change.
5. More than cross-cutting services must move to make the build pass.
6. Production notification send, external auth, storage, QR/camera, live AI, or a domain-event bus appears necessary.

## Self-Review

- Spec coverage: Covers every Phase 3 master-plan edit, test, acceptance criterion, and docs update while keeping capability extraction out of scope.
- Placeholder scan: No placeholder markers or unspecified test instructions are intentionally left in the plan.
- Type consistency: Provider tokens, module names, path aliases, and service names match the Phase 2 implementation and the target module names in the parent plan.