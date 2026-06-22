# Prism Defense Readiness Route Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move `GET /events/:eventId/defense-readiness` out of the legacy `event-ops` controller/service facade and into the read-only `event-read-models` module while preserving the public route contract.

**Architecture:** Defense readiness is a PMCM/system-only cross-domain read model, not a workflow command. `event-read-models` should own the controller and read composition, using approved query-builder methods plus public reader ports for staffing, guests, and closure gates. `event-ops` keeps only `/sample/*` compatibility routes after this slice.

**Tech Stack:** NestJS controllers/modules/providers, Vitest, Prisma query builders, `@prism/modules/event-read-models`, `@prism/modules/closure-ops`, `@prism/modules/staffing-ops`, `@prism/modules/guest-ops`, existing Prism boundary checker.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend/integration module ownership for redesign-safe role-scoped APIs. |
| Feature-ledger row | Backend modular monolith / whole-app redesign readiness route ownership. |
| Route/app/actor | `GET /events/:eventId/defense-readiness`, PMCM event command app, PMCM/system actor only. |
| Contract touched | Route path and response shape stay stable; no `packages/types` or API client contract change. |
| Fallback state | `event-ops` compatibility fallback removed for this route after tests pass. `/sample/*` stays compatibility-only. |
| Forbidden-role test | Client/guest actors denied by `EventReadModelsService.defenseReadiness` or controller route test. |
| Query budget | One selected event query, five event-scoped collection queries, plus staffing/guest/closure reader ports; no per-row Prisma loop. |
| Side-effect mode | `read_only`. |
| Route-smoke evidence | `npm --workspace prism-api run test -- defense-readiness controller-routes event-read-models.service`. |
| Docs updated | Master backend plan, Prism v4 architecture/current-state docs. |

## File Map

| File | Responsibility |
| --- | --- |
| `apps/api/libs/modules/event-read-models/src/controllers/defense-readiness.controller.ts` | Owns stable `/events/:eventId/defense-readiness` route and actor query DTO. |
| `apps/api/libs/modules/event-read-models/src/controllers/defense-readiness.controller.test.ts` | Proves route base/path ownership and service delegation. |
| `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.ts` | Adds read-only `defenseReadiness(actor, eventId)` composition. |
| `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.test.ts` | Moves/duplicates defense readiness PMCM/system allow and client/guest deny tests out of `EventOpsService`. |
| `apps/api/libs/modules/event-read-models/src/queries/event-read-models.queries.ts` | Adds a bounded defense-readiness query-builder method with query-budget comment. |
| `apps/api/libs/modules/event-read-models/src/event-read-models.module.ts` | Imports `ClosureOpsModule`, injects closure readiness reader, registers the new controller. |
| `apps/api/libs/modules/event-ops/src/controllers/events.controller.ts` | Remove local defense-readiness controller after the new owner is registered. |
| `apps/api/libs/modules/event-ops/src/controllers/index.ts` | Remove `OpsEventsController` from `EVENT_OPS_CONTROLLERS`; leave `SampleController`. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Remove `getDefenseReadiness` compatibility method after new service tests pass. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Remove or adjust defense-readiness tests that directly target `EventOpsService`. |
| `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md` | Update Phase 13 progress and controller ownership. |
| `docs/prism-v4/15-system-architecture.md` and `docs/prism-v4/17-current-state-2026-06-20.md` | Record that defense readiness route ownership moved to `event-read-models`; sample remains in `event-ops`. |

## Tasks

### Task 1: Add Defense Readiness Read-Model Tests

- [x] Add a PMCM success test to `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.test.ts` using mocked `queries.defenseReadiness`, `staffingReader`, `guestReader`, and `closureReadinessReader`; assert the existing response shape, query call, staffing reader call, guest reader calls, and closure gate call.
- [x] Add client and guest forbidden-role regressions; assert `queries.defenseReadiness` is not called when access is denied.
- [x] Run `npm --workspace prism-api run test -- event-read-models.service.test.ts`; expected before implementation: failure because `defenseReadiness` does not exist.

### Task 2: Implement Read-Only Query And Service Method

- [x] Add `EventReadModelQueries.defenseReadiness(eventId)` with a `Query budget:` comment and one `Promise.all` containing selected event, briefing, supplier quote request, supplier quote, event-day task, urgent issue, billing statement, and payment milestone queries.
- [x] Import `ClosureOpsModule` in `EventReadModelsModule`, inject `CLOSURE_READINESS_READER` into `EventReadModelsService`, and keep existing guest/staffing reader injections.
- [x] Move the pure composition logic from `EventOpsService.getDefenseReadiness` into `EventReadModelsService.defenseReadiness(actor, eventId)`, preserving response keys, labels, statuses, `liveAiBlocked`, `deferredScope`, and `generatedAt`.
- [x] Use `staffingReader.listAssignmentsForEvent`, `guestReader.listCheckInsForEvent`, `guestReader.listFeedbackForEvent`, and `closureReadinessReader.closeGates` instead of `EventOpsService` internals.
- [x] Run `npm --workspace prism-api run test -- event-read-models.service.test.ts`; expected after implementation: pass.

### Task 3: Move The HTTP Controller

- [x] Create `apps/api/libs/modules/event-read-models/src/controllers/defense-readiness.controller.test.ts` to assert route base `events` and delegation to `EventReadModelsService.defenseReadiness` with a resolved actor.
- [x] Create `apps/api/libs/modules/event-read-models/src/controllers/defense-readiness.controller.ts` for `GET :eventId/defense-readiness`, preserving actor query DTO behavior.
- [x] Register `OpsDefenseReadinessController` in `EventReadModelsModule.controllers`.
- [x] Remove `OpsEventsController` from `apps/api/libs/modules/event-ops/src/controllers/index.ts` and update `controller-routes.test.ts` to expect only `sample`.
- [x] Delete `apps/api/libs/modules/event-ops/src/controllers/events.controller.ts` after route tests pass.
- [x] Run `npm --workspace prism-api run test -- defense-readiness.controller.test.ts controller-routes.test.ts`.

### Task 4: Retire The EventOps Defense Method And Update Docs

- [x] Delete `EventOpsService.getDefenseReadiness` from `apps/api/libs/modules/event-ops/src/event-ops.service.ts`; keep `getCloseGates` for existing closure compatibility.
- [x] Remove the direct `EventOpsService.getDefenseReadiness` test block from `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` after equivalent read-model tests exist.
- [x] Update `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md` to add this child plan to Phase 13 progress and state that only `/sample/*` remains local to `event-ops`.
- [x] Update `docs/prism-v4/15-system-architecture.md` and `docs/prism-v4/17-current-state-2026-06-20.md` to record defense readiness route ownership under `event-read-models`.
- [x] Run verification: `npm --workspace prism-api run test -- defense-readiness event-read-models.service.test.ts controller-routes.test.ts`, `npm --workspace prism-api run build`, `npm run check:boundaries`, and `git diff --check`.
- [x] Commit with `git commit -m "refactor(api): move defense readiness route"`.

## Self-Review

- Spec coverage: Covers the only remaining business route in the local `event-ops` controller registry and preserves `/sample/*` compatibility.
- Placeholder scan: No `TBD`, generic TODO, or unspecified test commands remain.
- Type consistency: The service method name is `defenseReadiness`, the route controller is `OpsDefenseReadinessController`, and the route path stays `/events/:eventId/defense-readiness`.