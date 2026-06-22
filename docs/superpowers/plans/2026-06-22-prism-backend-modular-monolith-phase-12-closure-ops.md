# Closure-Ops Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move event closure/archive command ownership and closure readiness reads into a dedicated `closure-ops` API module while preserving existing event-ops route contracts.

**Architecture:** `closure-ops` owns archive commands, post-event document completion, PMCM event-insight reads/writes, and close-gate readiness composition. It imports public modules only: `event-core`, `trust-ops`, `notification-ops`, `access-control`, `file-ops`, and `database`. `event-ops` remains the route compatibility facade until controller ownership moves in Phase 13.

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend capability ownership and role-scoped contract foundation. |
| Feature-ledger row | Closure/archive readiness, event insights, audit/privacy, file completion, and redesign role payload safety. |
| Route/app/actor | Existing PMCM event archive and insight routes through `apps/event`; actors are PMCM/system for closure commands and insight reads. |
| Contract touched | API module internals only; route paths and response DTO mapping remain stable through `EventOpsService`. |
| Fallback state | Old `event-ops/src/services/event-closure.service.ts` path remains a compatibility re-export. |
| Forbidden-role test | Client actor cannot archive an event. |
| Side-effect mode | Archive/insight commands use workflow-command side effects for audit/outbox. Readiness reads do not write. |
| Route-smoke evidence | `npm --workspace prism-api run test -- event-lifecycle.service.test.ts event-ops.service.test.ts`, `npm --workspace prism-api run test:event-ops`, build, and boundary checks. |

## File Structure

- Create: `apps/api/libs/modules/closure-ops/src/closure-ops.module.ts`.
- Create: `apps/api/libs/modules/closure-ops/src/index.ts`.
- Create: `apps/api/libs/modules/closure-ops/src/ports/closure-ops.tokens.ts`.
- Create: `apps/api/libs/modules/closure-ops/src/ports/closure-commands.port.ts`.
- Create: `apps/api/libs/modules/closure-ops/src/ports/closure-readiness-reader.port.ts`.
- Create: `apps/api/libs/modules/closure-ops/src/services/event-closure.service.ts`.
- Create: `apps/api/libs/modules/closure-ops/tsconfig.lib.json`.
- Move: `EventLifecycleService` implementation to `event-core` and keep the old path as a re-export.
- Modify: `event-ops` module/service/tests to consume public `closure-ops` and `event-core` exports.
- Modify: API tsconfig, Vitest aliases, and Nest library project registration.
- Modify: boundary test to prove `closure-ops` cannot import event-ops internals.
- Modify: master plan and Prism v4 architecture/current-state docs after verification.

## Tasks

- [x] Create `closure-ops` module, public tokens, command/readiness ports, barrel, and tsconfig.
- [x] Move `EventClosureService` into `closure-ops` with only public module imports.
- [x] Move `EventLifecycleService` into `event-core` so closure lifecycle invariants are public and narrow.
- [x] Keep old `event-ops` closure/lifecycle service paths as compatibility re-exports.
- [x] Wire `EventOpsModule` through `ClosureOpsModule`; remove local closure/lifecycle provider ownership from `event-ops`.
- [x] Add archive permission enforcement for PMCM/system actors with compatibility default behavior.
- [x] Add forbidden-role regression: client actor cannot archive an event.
- [x] Add boundary regression: `closure-ops` importing event-ops internals is rejected.
- [x] Run targeted lifecycle/archive tests, event-ops tests, build, boundary unit test, and boundary checker.
- [x] Update master plan and Prism v4 docs.

## Self-Review

- Spec coverage: Closure writes now live in `closure-ops`; readiness reads and event-insight reads/writes moved with the service; public command/readiness ports exist; old route contracts remain stable through `EventOpsService`.
- Boundary clarity: `closure-ops` imports public modules only and the boundary unit test explicitly catches event-ops internal imports.
- Limitations: Controller ownership remains in `event-ops` until Phase 13. Closure readiness enters through the public file-ops matrix service in this slice; deeper readiness composition can be further split into supplier/finance/file/compliance/floorplan/guest/staffing reader ports as those modules expose richer closure-specific readers.