# Prism Backend Modular Monolith Phase 7C Compliance Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Extract compliance rule, compliance check generation, and compliance resolution behavior into `compliance-ops` while preserving existing event/compliance route contracts.

**Architecture:** `compliance-ops` owns compliance command behavior and public compliance reader contracts. The module imports `DatabaseModule`, `EventCoreModule`, `TrustOpsModule`, and `AccessControlModule` so it uses public providers for Prisma, workflow commands, audit, and actor policy instead of private `event-ops` internals. `event-ops` remains the route facade during this phase; controller moves remain Phase 13 work and read-model extraction remains Phase 11 work.

**Tech Stack:** NestJS modules/providers, PrismaService, Vitest, TypeScript path aliases, existing event-ops compatibility facade, `@prism/modules/event-core`, `@prism/modules/trust-ops`, `@prism/modules/access-control`, `@prism/database`, and current event-ops route tests.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Stable backend ownership for compliance rules/checks so redesign work can depend on PMCM-only compliance workflows without leaking audit storage or role-scoped payloads. |
| Feature-ledger row | FL-014 compliance checks, FL-015 defense/readiness gates, and the Owner D backend/integration foundation row in the redesign inventory. |
| Route/app/actor | Existing event routes `POST /events/:eventId/compliance`, `PATCH /events/:eventId/compliance/:checkId`, and `compliance` controller routes. PMCM/system actors manage compliance; client/supplier/guest actors must be denied. |
| Contract touched | Backend module exports and API TypeScript aliases. No `packages/types` or `packages/api-client` changes unless build proves a compatibility export is missing. |
| Fallback state | Existing `event-ops` route facade stays. Read-model field allowlists and controller moves remain deferred until `event-read-models` and controller ownership phases. |
| Forbidden-role test | Add focused service/facade coverage that supplier/guest actors cannot create/update/list compliance rules or resolve compliance checks. Existing event-ops role payload tests must continue passing. |
| Query budget | Compliance run performs event lookup, inquiry lookup, one active-rule query, one transaction that replaces checks and updates event readiness, then one check list query. Rule list is one bounded query. Resolve is one check update. |
| Side-effect mode | Existing `WorkflowCommandService` mode: DB write first, then audit side effects. Compliance run uses one Prisma transaction for delete/create/readiness update/check read. Audit storage stays in `trust-ops`. |
| Route-smoke evidence | `npm --workspace prism-api run test -- compliance`, `npm --workspace prism-api run test -- event-ops.service.test.ts`, `npm --workspace prism-api run test:event-ops`, `npm --workspace prism-api run build`, `npm run check:boundaries`. |
| Docs updated | Parent Phase 7C checklist, this child plan, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## Current Findings

- `apps/api/libs/modules/event-ops/src/services/compliance-workflow.service.ts` owns `listComplianceRules`, `createComplianceRule`, `updateComplianceRule`, `runCompliance`, and `resolveCompliance`.
- The service imports `AuditService`, `EventAccessPolicyService`, and `WorkflowCommandService` through private `event-ops` relative paths. The extraction must switch those imports to public modules.
- `EventOpsService` delegates compliance methods around `listComplianceRules`, `createComplianceRule`, `updateComplianceRule`, `runCompliance`, and `resolveCompliance`.
- Existing `event-ops.service.test.ts` covers compliance check generation and override reason validation, but the service itself does not have a focused module test yet.
- Audit persistence must remain in `trust-ops`; `compliance-ops` should inject `AuditService` from `TrustOpsModule`, not move or duplicate audit logic.

## Scope Rules

In scope:

- Create `apps/api/libs/modules/compliance-ops`.
- Move `ComplianceWorkflowService` into `compliance-ops`.
- Add public ports: `COMPLIANCE_COMMANDS`, `COMPLIANCE_READER`, `ComplianceCommands`, and `ComplianceReader`.
- Add `ComplianceOpsModule` that provides/exports `ComplianceWorkflowService`, `COMPLIANCE_COMMANDS`, and `COMPLIANCE_READER`.
- Keep `event-ops` compatibility re-export at the old compliance service path.
- Update `EventOpsModule`, `EventOpsService`, and `event-ops.service.test.ts` to import compliance behavior from `@prism/modules/compliance-ops`.
- Preserve public route paths and response mapping.
- Add focused compliance tests before and after the move.

Out of scope:

- Moving controllers.
- Moving audit storage or privacy logic.
- Moving event-read-model compliance payload composition.
- Adding new compliance rule semantics beyond preserving current behavior.
- Changing public HTTP paths, DTOs, or API client contracts.

## Files To Create Or Move

| File | Purpose |
| --- | --- |
| `apps/api/libs/modules/compliance-ops/src/services/compliance-workflow.service.ts` | Moved compliance workflow owner. |
| `apps/api/libs/modules/compliance-ops/src/services/compliance-workflow.service.test.ts` | Focused compliance workflow tests. |
| `apps/api/libs/modules/compliance-ops/src/ports/compliance-ops.tokens.ts` | `COMPLIANCE_COMMANDS` and `COMPLIANCE_READER` tokens. |
| `apps/api/libs/modules/compliance-ops/src/ports/compliance-commands.port.ts` | Public compliance command interface and input type exports. |
| `apps/api/libs/modules/compliance-ops/src/ports/compliance-reader.port.ts` | Public compliance reader interface. |
| `apps/api/libs/modules/compliance-ops/src/compliance-ops.module.ts` | Runtime module wiring public dependencies. |
| `apps/api/libs/modules/compliance-ops/src/index.ts` | Public exports. |
| `apps/api/libs/modules/compliance-ops/tsconfig.lib.json` | Library tsconfig. |
| `apps/api/libs/modules/event-ops/src/services/compliance-workflow.service.ts` | Compatibility re-export. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import `ComplianceOpsModule`; remove local compliance provider. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Import moved service/types from compliance-ops. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` | Import moved service from compliance-ops. |
| `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, `apps/api/nest-cli.json` | Add compliance-ops aliases and Nest metadata. |
| `docs/prism-v4/15-system-architecture.md` | Record current compliance extraction. |
| `docs/prism-v4/17-current-state-2026-06-20.md` | Add post-snapshot compliance extraction note. |
| `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md` | Update Phase 7C checklist only for proven work. |

## Task 1 - Add Focused Compliance Tests Before Moving

- [x] Create `apps/api/libs/modules/event-ops/src/services/compliance-workflow.service.test.ts` with focused tests for compliance run, override validation, and role denial.
- [x] The test must instantiate `ComplianceWorkflowService` with mocked Prisma, `AuditService`, `EventAccessPolicyService`, and `WorkflowCommandService`.
- [x] The first test must call `runCompliance('evt_sample', { phase: 'planning' })` and assert one matching check is created, event readiness becomes `Must-Fix item open`, and audit receives `Ran compliance checks` with `ruleCount: 1`.
- [x] The second test must seed one check and assert `resolveCompliance('evt_sample', 'chk_sample', { action: 'override' })` rejects with `BadRequestException` when `overrideReason` is missing.
- [x] The third test must call `listComplianceRules({ role: 'supplier', name: 'Supplier', explicit: true } as any)` and assert `ForbiddenException`.
- [x] Run `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/compliance-workflow.service.test.ts`.
  Expected before move: PASS with 1 file and 3 tests.

## Task 2 - Create Compliance-Ops Module Shell

- [x] Create directories `apps/api/libs/modules/compliance-ops/src/ports` and `apps/api/libs/modules/compliance-ops/src/services`.
- [x] Add `@prism/modules/compliance-ops` and `@prism/modules/compliance-ops/*` aliases in `apps/api/tsconfig.json`.
- [x] Add `@prism/modules/compliance-ops` alias in `apps/api/vitest.config.ts`.
- [x] Add `compliance-ops` project metadata in `apps/api/nest-cli.json` using root `libs/modules/compliance-ops`, entry `index`, sourceRoot `libs/modules/compliance-ops/src`, and tsConfig `libs/modules/compliance-ops/tsconfig.lib.json`.
- [x] Create `apps/api/libs/modules/compliance-ops/tsconfig.lib.json` with this content:

```json
{
  "extends": "../../../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../../../dist/libs/modules/compliance-ops"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [x] Create `apps/api/libs/modules/compliance-ops/src/ports/compliance-ops.tokens.ts`:

```ts
export const COMPLIANCE_COMMANDS = Symbol('COMPLIANCE_COMMANDS');
export const COMPLIANCE_READER = Symbol('COMPLIANCE_READER');
```

- [x] Create `apps/api/libs/modules/compliance-ops/src/ports/compliance-commands.port.ts` exporting `ComplianceCommands` with `createComplianceRule`, `updateComplianceRule`, `runCompliance`, and `resolveCompliance` signatures.
- [x] Create `apps/api/libs/modules/compliance-ops/src/ports/compliance-reader.port.ts` exporting `ComplianceReader` with `listComplianceRules(actor: ResolvedEventOpsActor)`.
- [x] Create `apps/api/libs/modules/compliance-ops/src/compliance-ops.module.ts` with imports `[DatabaseModule, EventCoreModule, TrustOpsModule, AccessControlModule]`, provider `ComplianceWorkflowService`, token providers for `COMPLIANCE_COMMANDS` and `COMPLIANCE_READER`, and exports for the service plus tokens.
- [x] Create `apps/api/libs/modules/compliance-ops/src/index.ts` exporting the module, ports, tokens, and service.

## Task 3 - Move Compliance Workflow

- [x] Move `apps/api/libs/modules/event-ops/src/services/compliance-workflow.service.ts` to `apps/api/libs/modules/compliance-ops/src/services/compliance-workflow.service.ts`.
- [x] Move `apps/api/libs/modules/event-ops/src/services/compliance-workflow.service.test.ts` to `apps/api/libs/modules/compliance-ops/src/services/compliance-workflow.service.test.ts`.
- [x] Replace old service path with `export * from '@prism/modules/compliance-ops';`.
- [x] In the moved service, replace private relative imports with public imports from `@prism/modules/event-core`, `@prism/modules/trust-ops`, and `@prism/modules/access-control`.
- [x] In the moved test, replace private relative imports with public imports from `@prism/modules/trust-ops`, `@prism/modules/access-control`, and `@prism/modules/event-core`.

## Task 4 - Wire Event-Ops Compatibility

- [x] Update `apps/api/libs/modules/event-ops/src/event-ops.module.ts` to import `ComplianceOpsModule` and `ComplianceWorkflowService` from `@prism/modules/compliance-ops`.
- [x] Remove `ComplianceWorkflowService` from the local service import block.
- [x] Add `ComplianceOpsModule` to the module imports array.
- [x] Update `apps/api/libs/modules/event-ops/src/event-ops.service.ts` imports so `ComplianceRunInput`, `CreateComplianceRuleInput`, `ResolveComplianceInput`, `UpdateComplianceRuleInput`, and `ComplianceWorkflowService` come from `@prism/modules/compliance-ops`.
- [x] Update `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` so `ComplianceWorkflowService` imports from `@prism/modules/compliance-ops`.

## Task 5 - Verification And Docs Closeout

- [x] Run `npm --workspace prism-api run test -- libs/modules/compliance-ops/src/services/compliance-workflow.service.test.ts`.
- [x] Run `npm --workspace prism-api run test -- compliance`.
- [x] Run `npm --workspace prism-api run test:event-ops`.
- [x] Run `npm --workspace prism-api run build`.
- [x] Run `npm run check:boundaries`.
- [x] Run `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/commercial-ops|modules/commercial-ops|@prism/modules/finance-ops|modules/finance-ops|@prism/modules/supplier-ops|modules/supplier-ops|@prism/modules/file-ops|modules/file-ops|@prism/modules/inquiry-onboarding|modules/inquiry-onboarding" apps/api/libs/modules/compliance-ops`; expected result: no matches.
- [x] Run `git diff --check`.
- [x] Update parent Phase 7C checklist only for items proven by this slice.
- [x] Add verification evidence to this child plan.
- [x] Update `docs/prism-v4/15-system-architecture.md` with the compliance extraction note.
- [x] Update `docs/prism-v4/17-current-state-2026-06-20.md` with a post-snapshot compliance-ops note.
- [x] Commit checkpoint: `refactor(api): extract compliance operations module`.

## Acceptance Criteria

- [x] `ComplianceWorkflowService` lives under `compliance-ops` and is provided/exported by `ComplianceOpsModule`.
- [x] `ComplianceWorkflowService` no longer imports private `event-ops` services.
- [x] `ComplianceOpsModule` imports `TrustOpsModule` for audit storage and does not own audit persistence.
- [x] Compliance rule listing, rule creation/update, compliance check generation, and compliance resolution stay reachable through `EventOpsService` compatibility methods.
- [x] Compliance check generation and override validation tests pass.
- [x] Supplier/guest forbidden-role coverage for compliance operations passes.
- [x] API build, event-ops compatibility tests, boundary check, no-private-import scan, and diff check pass.

## Verification Evidence

| Command | Result |
| --- | --- |
| `npm --workspace prism-api run test -- libs/modules/event-ops/src/services/compliance-workflow.service.test.ts` | Passed before move: 1 file, 3 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run test -- libs/modules/compliance-ops/src/services/compliance-workflow.service.test.ts` | Passed after move: 1 file, 3 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run test -- compliance` | Passed: 1 file, 3 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run test:event-ops` | Passed: 10 files, 85 tests. Initial sandbox run failed at Vite config load with `spawn EPERM`; escalated rerun passed. |
| `npm --workspace prism-api run build` | Passed. Initial sandbox run failed on `dist` unlink `EPERM`; escalated rerun passed. |
| `npm run check:boundaries` | Passed for 494 files. Initial sandbox run failed on `spawnSync git EPERM`; escalated rerun passed. |
| `rg -n "@prism/modules/event-ops|modules/event-ops|@prism/modules/commercial-ops|modules/commercial-ops|@prism/modules/finance-ops|modules/finance-ops|@prism/modules/supplier-ops|modules/supplier-ops|@prism/modules/file-ops|modules/file-ops|@prism/modules/inquiry-onboarding|modules/inquiry-onboarding" apps/api/libs/modules/compliance-ops` | Passed with no matches; `rg` exited 1 as expected for no results. |
| `git diff --check` | Passed; remaining output was line-ending normalization warnings only. |

## Implementation Notes

- `ComplianceWorkflowService` now lives under `apps/api/libs/modules/compliance-ops/src/services` and is provided/exported by `ComplianceOpsModule`.
- `ComplianceOpsModule` exports `COMPLIANCE_COMMANDS` and `COMPLIANCE_READER`.
- The moved service imports `AuditService` from `trust-ops`, `EventAccessPolicyService` from `access-control`, and `WorkflowCommandService`/compliance constants from `event-core`.
- The old `event-ops` compliance workflow path is a compatibility re-export.
- `EventOpsModule` imports `ComplianceOpsModule`; compliance route behavior continues through `EventOpsService` compatibility methods.
- Audit storage remains in `trust-ops`; compliance-ops owns workflow commands and reads, not audit persistence.

## Stop Rules

Stop and revise before implementation if:

1. `ComplianceOpsModule` cannot provide `ComplianceWorkflowService` without importing `EventOpsModule`.
2. Moving compliance behavior forces public route path or DTO changes.
3. Compliance workflow needs to import private `event-ops` services.
4. Audit storage logic has to move out of `trust-ops`.
5. Read-model payload composition must move in the same branch.
6. A portal route starts reading PMCM-only compliance payloads.

## Self-Review

| Requirement | Coverage |
| --- | --- |
| Phase 7C child plan exists before implementation | This plan separates compliance-ops from inquiry and commercial work. |
| Owner D evidence gate | Evidence table includes owner goal, feature rows, route/actor, contracts, fallback, forbidden-role coverage, query budget, side effects, route smoke, and docs. |
| Provider feasibility | The module imports existing public event-core, trust-ops, and access-control modules. |
| Public ports | Task 2 adds command and reader tokens/interfaces. |
| Audit ownership | Acceptance criteria and stop rules keep audit storage in `trust-ops`. |
| Verification | Task 5 covers focused tests, route compatibility, build, boundaries, private import scan, and diff check. |
