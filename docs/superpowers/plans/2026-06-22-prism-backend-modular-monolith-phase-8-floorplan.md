# Prism Backend Modular Monolith Phase 8 Floorplan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract official PMCM floorplan workflow and client layout preference behavior into `floorplan` while preserving existing event route contracts and canvas/editor data shape.

**Architecture:** `floorplan` owns floorplan write workflows and floorplan snapshot/read ports. `EventOpsService` keeps route compatibility and actor policy checks during this phase, then delegates to `FloorPlanWorkflowService` from `@prism/modules/floorplan`. The service continues using the existing `floorPlan`, `floorPlanObject`, and `opsFloorPlanDraft` persistence shape so canvas/editor internals remain intact.

**Tech Stack:** NestJS modules/providers, PrismaService, Vitest, TypeScript path aliases, existing event-ops compatibility facade, `@prism/modules/event-core`, `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, `@prism/database`, `@prism/shared`, and current event-ops route tests.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Stable backend ownership for floorplan workflows so PMCM, client portal, and event command redesign work can rely on the AGENTS floorplan rule without role leakage. |
| Feature-ledger row | FL-016 official floorplan workflow, FL-017 client layout preferences, FL-018 client read-only approved official layout, and Owner D backend/integration foundation. |
| Route/app/actor | Existing event routes `POST /events/:eventId/floorplans`, `POST /events/:eventId/floorplan-preferences`, `POST /events/:eventId/floorplans/:draftId/submit`, `POST /events/:eventId/floorplans/:draftId/approve`, and `GET /events/:eventId/floorplans/:draftId/snapshot`. PMCM edits/submits/approves official floorplans; clients submit preferences and read submitted/approved snapshots only when they can read the event. |
| Contract touched | Backend module exports and API TypeScript aliases. No `packages/types` or `packages/api-client` change unless build proves a compatibility export is missing. |
| Fallback state | Existing `event-ops` route facade stays. Controller ownership and read-model extraction remain deferred to Phase 13 and Phase 11. |
| Forbidden-role test | Existing event-ops client-denial test must keep passing. Add focused floorplan service tests plus facade coverage proving client actors cannot create PMCM official drafts. |
| Query budget | Official draft/preference writes perform one event lookup and one transaction creating/updating `floorPlan`, `floorPlanObject`, `opsFloorPlanDraft`, and `opsEvent`. Snapshot read performs one draft lookup plus one floorPlan lookup when snapshot creation occurs; stored snapshot read is one draft lookup. |
| Side-effect mode | Existing `WorkflowCommandService` mode: floorplan write transaction first, then audit/outbox side effects. Snapshot reads are read-only. |
| Route-smoke evidence | `npm --workspace prism-api run test -- floor`, `npm --workspace prism-api run test -- event-ops.service.test.ts`, `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, `npm run check:boundaries`. |
| Docs updated | Parent Phase 8 checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## Current Findings

- `apps/api/libs/modules/event-ops/src/services/floor-plan-workflow.service.ts` owns `createFloorPlanDraft`, `createFloorPlanPreference`, `submitFloorPlanDraft`, `approveFloorPlanDraft`, `getFloorPlanSnapshot`, and `mapFloorPlanDraft`.
- `EventOpsService` already enforces the AGENTS floorplan role split before delegating: PMCM/system can mutate official floorplans, client/PMCM/system can submit layout preferences, and readable actors can fetch submitted/approved snapshots.
- Existing `event-ops.service.test.ts` covers submitted/approved snapshot immutability and client denial for PMCM official draft creation.
- The service currently imports audit/outbox/workflow dependencies through private `event-ops` relative paths. The extraction must switch those to public modules.
- Canvas/editor persistence depends on existing `floorPlan`, `floorPlanObject`, and `opsFloorPlanDraft` writes. This phase must not redesign those persisted shapes.

## Scope Rules

In scope:

- Create `apps/api/libs/modules/floorplan`.
- Move `FloorPlanWorkflowService` and focused tests into `floorplan`.
- Add public ports: `FLOORPLAN_COMMANDS`, `FLOORPLAN_READER`, `FloorplanCommands`, and `FloorplanReader`.
- Add `FloorplanModule` that provides/exports `FloorPlanWorkflowService`, `FLOORPLAN_COMMANDS`, and `FLOORPLAN_READER`.
- Keep `event-ops` compatibility re-export at the old floorplan service path.
- Update `EventOpsModule`, `EventOpsService`, and `event-ops.service.test.ts` to import floorplan behavior from `@prism/modules/floorplan`.
- Preserve public route paths, response mapping, canvas/editor object persistence, and snapshot behavior.

Out of scope:

- Moving controllers.
- Redesigning the canvas/editor model.
- Changing public HTTP paths or DTOs.
- Moving event-read-model floorplan composition.
- Adding new floorplan features beyond ownership extraction and focused role/read tests.

## Files To Create Or Move

| File | Purpose |
| --- | --- |
| `apps/api/libs/modules/floorplan/src/services/floor-plan-workflow.service.ts` | Moved floorplan workflow owner. |
| `apps/api/libs/modules/floorplan/src/services/floor-plan-workflow.service.test.ts` | Focused floorplan workflow tests. |
| `apps/api/libs/modules/floorplan/src/ports/floorplan.tokens.ts` | `FLOORPLAN_COMMANDS` and `FLOORPLAN_READER` tokens. |
| `apps/api/libs/modules/floorplan/src/ports/floorplan-commands.port.ts` | Public floorplan command interface and input exports. |
| `apps/api/libs/modules/floorplan/src/ports/floorplan-reader.port.ts` | Public floorplan reader interface. |
| `apps/api/libs/modules/floorplan/src/floorplan.module.ts` | Runtime module wiring public dependencies. |
| `apps/api/libs/modules/floorplan/src/index.ts` | Public exports. |
| `apps/api/libs/modules/floorplan/tsconfig.lib.json` | Library tsconfig. |
| `apps/api/libs/modules/event-ops/src/services/floor-plan-workflow.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import `FloorplanModule`; remove local floorplan provider. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Import moved service/types from floorplan. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Import moved service from floorplan. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add floorplan aliases and Nest metadata. |
| `docs/prism-v4/15-system-architecture.md` | Record current floorplan extraction. |
| `docs/prism-v4/17-current-state-2026-06-20.md` | Add post-snapshot floorplan extraction note. |
| `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md` | Update Phase 8 checklist only for proven work. |

## Task 1 - Add Focused Floorplan Tests Before Moving

- [ ] Create `apps/api/libs/modules/event-ops/src/services/floor-plan-workflow.service.test.ts` with focused tests for PMCM official draft creation, client preference submission, submitted/approved snapshot reads, and canvas object persistence.
- [ ] The test must instantiate `FloorPlanWorkflowService` with mocked Prisma, `AuditService`, `NotificationOutboxService`, and `WorkflowCommandService`.
- [ ] The PMCM draft test must assert `floorPlan`, `floorPlanObject`, `opsFloorPlanDraft`, and `opsEvent` are written and the mapped draft status is `pmcm_draft`.
- [ ] The client preference test must assert `status: client_submitted`, `createdByRole: client`, event readiness `Client layout preference received`, and a PMCM notification.
- [ ] The snapshot test must create a draft and stored submitted/approved snapshots, then assert `getFloorPlanSnapshot` returns the requested snapshot without changing objects.
- [ ] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/floor-plan-workflow.service.test.ts`.
  Expected before move: PASS.

## Task 2 - Create Floorplan Module Shell

- [ ] Create directories `apps/api/libs/modules/floorplan/src/ports` and `apps/api/libs/modules/floorplan/src/services`.
- [ ] Add `@prism/modules/floorplan` and `@prism/modules/floorplan/*` aliases in `apps/api/tsconfig.json`.
- [ ] Add `@prism/modules/floorplan` alias in `apps/api/vitest.config.ts`.
- [ ] Add `floorplan` project metadata in `apps/api/nest-cli.json`.
- [ ] Create `apps/api/libs/modules/floorplan/tsconfig.lib.json`.
- [ ] Create `apps/api/libs/modules/floorplan/src/ports/floorplan.tokens.ts` exporting `FLOORPLAN_COMMANDS` and `FLOORPLAN_READER`.
- [ ] Create `apps/api/libs/modules/floorplan/src/ports/floorplan-commands.port.ts` exporting the command interface for official draft, client preference, submit, and approve operations.
- [ ] Create `apps/api/libs/modules/floorplan/src/ports/floorplan-reader.port.ts` exporting reader interface for `getFloorPlanSnapshot` and `mapFloorPlanDraft`.
- [ ] Create `apps/api/libs/modules/floorplan/src/floorplan.module.ts` importing `[DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule]`, providing `FloorPlanWorkflowService`, and exporting service plus tokens.
- [ ] Create `apps/api/libs/modules/floorplan/src/index.ts` exporting the module, ports, tokens, and service.

## Task 3 - Move Floorplan Workflow

- [ ] Move `apps/api/libs/modules/event-ops/src/services/floor-plan-workflow.service.ts` to `apps/api/libs/modules/floorplan/src/services/floor-plan-workflow.service.ts`.
- [ ] Move `apps/api/libs/modules/event-ops/src/services/floor-plan-workflow.service.test.ts` to `apps/api/libs/modules/floorplan/src/services/floor-plan-workflow.service.test.ts`.
- [ ] Replace old service path with `export * from '@prism/modules/floorplan';`.
- [ ] In the moved service, replace private relative imports with public imports from `@prism/modules/event-core`, `@prism/modules/trust-ops`, and `@prism/modules/notification-ops`.
- [ ] In the moved test, replace private relative imports with public imports from `@prism/modules/trust-ops`, `@prism/modules/notification-ops`, and `@prism/modules/event-core`.

## Task 4 - Wire Event-Ops Compatibility

- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.module.ts` to import `FloorplanModule` and `FloorPlanWorkflowService` from `@prism/modules/floorplan`.
- [ ] Remove `FloorPlanWorkflowService` from local event-ops providers.
- [ ] Add `FloorplanModule` to the module imports array.
- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.service.ts` imports so `CreateFloorPlanDraftInput`, `CreateFloorPlanPreferenceInput`, and `FloorPlanWorkflowService` come from `@prism/modules/floorplan`.
- [ ] Update `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` so `FloorPlanWorkflowService` imports from `@prism/modules/floorplan`.

## Task 5 - Verification And Docs Closeout

- [ ] Run `npm --workspace prism-api run test -- libs/modules/floorplan/src/services/floor-plan-workflow.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test -- floor`.
- [ ] Run `npm --workspace prism-api run test -- event-ops.service.test.ts`.
- [ ] Run `npm --workspace prism-api run test:event-ops`.
- [ ] Run `npm --workspace prism-api run build`.
- [ ] Run `npm run check:boundaries`.
- [ ] Run `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/commercial-ops|modules/commercial-ops|@prism/modules/compliance-ops|modules/compliance-ops|@prism/modules/finance-ops|modules/finance-ops|@prism/modules/supplier-ops|modules/supplier-ops|@prism/modules/file-ops|modules/file-ops|@prism/modules/inquiry-onboarding|modules/inquiry-onboarding" apps/api/libs/modules/floorplan`; expected result: no matches.
- [ ] Run `git diff --check`.
- [ ] Update parent Phase 8 checklist only for items proven by this slice.
- [ ] Add verification evidence to this child plan.
- [ ] Update `docs/prism-v4/15-system-architecture.md` with the floorplan extraction note.
- [ ] Update `docs/prism-v4/17-current-state-2026-06-20.md` with a post-snapshot floorplan note.
- [ ] Commit checkpoint: `refactor(api): extract floorplan module`.

## Acceptance Criteria

- [ ] `FloorPlanWorkflowService` lives under `floorplan` and is provided/exported by `FloorplanModule`.
- [ ] Floorplan writes live in `floorplan` and no longer import private `event-ops` services.
- [ ] PMCM official draft/submit/approve behavior remains route-compatible through `EventOpsService`.
- [ ] Client layout preference submission remains route-compatible through `EventOpsService`.
- [ ] Clients can read submitted/approved official snapshots only when they can read the event.
- [ ] Client actors cannot mutate PMCM official floorplans directly.
- [ ] Canvas/editor object persistence remains unchanged through `floorPlan`, `floorPlanObject`, and `opsFloorPlanDraft` writes.
- [ ] API build, event-ops compatibility tests, boundary check, no-private-import scan, and diff check pass.

## Stop Rules

Stop and revise before implementation if:

1. `FloorplanModule` cannot provide `FloorPlanWorkflowService` without importing `EventOpsModule`.
2. Moving floorplan behavior forces public route path or DTO changes.
3. Floorplan workflow needs to import private `event-ops` services.
4. The extraction changes persisted canvas/editor object shape.
5. Client actors can mutate PMCM official floorplan state.
6. Read-model payload composition must move in the same branch.

## Self-Review

| Requirement | Coverage |
| --- | --- |
| Phase 8 child plan exists before implementation | This plan separates floorplan extraction from later guest/staffing/read-model phases. |
| Owner D evidence gate | Evidence table includes owner goal, feature rows, route/actor, contracts, fallback, forbidden-role coverage, query budget, side effects, route smoke, and docs. |
| AGENTS floorplan rule | Scope, tests, and acceptance criteria separate PMCM official floorplans from client layout preferences. |
| Provider feasibility | The module imports existing public event-core, trust-ops, notification-ops, and database modules. |
| Public ports | Task 2 adds command and reader tokens/interfaces. |
| Canvas/editor preservation | Scope, tests, and acceptance criteria keep existing floorPlan/floorPlanObject/opsFloorPlanDraft persistence. |
| Verification | Task 5 covers focused tests, route compatibility, build, boundaries, private import scan, and diff check. |