# Prism Backend Modular Monolith Phase 4-12 Reconciliation

Date: 2026-06-22
Branch: `backend-modular-monolith-plan`
Purpose: classify every currently unchecked implementation-plan item found in Phases 4-12 before any claim that the backend modular monolith goal is complete.

## Classification Key

| Classification | Meaning |
| --- | --- |
| `completed with evidence` | The item is satisfied by current code/tests/docs and can be tied to a concrete file or command. |
| `covered by later phase` | The original phase checkbox was not backfilled, but a later phase/slice implemented or verified the same behavior. |
| `still missing` | The current repo does not contain strong evidence for the exact requirement. Keep this open before final completion. |
| `deferred by design` | The item depends on an intentionally gated or not-yet-approved capability and should not block the current backend refactor unless that scope is approved. |

## Command Evidence Gathered

| Command | Result |
| --- | --- |
| `npm --workspace prism-api run test -- supplier billing file guest` | Passed elevated after sandbox `spawn EPERM`: 18 files, 43 tests. |
| `npm --workspace prism-api run build` | Passed elevated after sandbox generated-output unlink `EPERM`. |
| `npm run check:boundaries` | Passed elevated after sandbox `spawnSync git EPERM`: 646 files. |
| `git diff --check` | Passed before this reconciliation doc was written. |

## Master Plan Open Items: Phases 4-7

Phases 8-12 have no unchecked boxes in the master plan. The only master-plan unchecked boxes in the Phase 4-12 range are below.

| Phase | Open item | Classification | Evidence / action |
| --- | --- | --- | --- |
| 4 | Add role-scope tests for PMCM and supplier portal reads. | `covered by later phase` | Supplier portal reads are covered by `apps/api/libs/modules/event-read-models/src/services/event-read-models.service.test.ts` supplier workspace/readiness tests and `apps/api/libs/modules/event-read-models/src/controllers/supplier-workspace.controller.test.ts`; PMCM reads are covered by `pmcm-dashboard.controller.test.ts`, `events.controller.test.ts`, and event-read-model service tests. |
| 4 | Add one route-smoke evidence command for PMCM supplier assignment and supplier portal readiness. | `covered by later phase` | Route-level evidence now exists through `apps/api/libs/modules/supplier-ops/src/controllers/supplier-workspace-commands.controller.test.ts`, `event-supplier-withdrawal.controller.test.ts`, `supplier-pare.controller.test.ts`, and the passing `supplier` Vitest pattern. |
| 4 | Supplier assignment mutation test. | `completed with evidence` | `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts` verifies scoped supplier assignment confirmation, readiness, contract upload, and event-day status; `supplier-network-workflow.service.ts` owns `confirmSupplierAssignment`. |
| 4 | Forbidden-role test: client or guest cannot mutate supplier assignments. | `still missing` | Current tests verify wrong supplier denial for assignment confirmation, but I did not find an explicit client/guest denial test for `confirmSupplierAssignment`. Add a focused test in `supplier-network-workflow.service.test.ts` or route-level controller tests. |
| 4 | Read-model test: supplier payload excludes PMCM-only finance/private fields. | `completed with evidence` | `apps/api/libs/modules/event-read-models/src/controllers/supplier-workspace.controller.test.ts` asserts supplier quote payload does not expose internal range fields such as `acceptableMin`; service tests cover supplier workspace visibility. |
| 4 | `npm --workspace prism-api run test -- supplier`. | `completed with evidence` | Covered by `npm --workspace prism-api run test -- supplier billing file guest`, which passed elevated with 18 files and 43 tests. |
| 5 | Keep supplier assignment reads through `SupplierReadinessReader`, not private supplier services. | `still missing` | `SupplierReadinessReader` exists, but current supplier readiness board composition is in `event-read-models` query/read-model code rather than clearly consuming the `SupplierReadinessReader` port. Decide whether to wire the port or update the design to bless the read-model query builder. |
| 5 | Update read models to use finance reader ports or approved finance query builders. | `completed with evidence` | `apps/api/libs/modules/event-read-models/src/queries/event-read-models.queries.ts` has finance query-budget comments and `billingForEvents`; `EventReadModelsService.billing` uses that approved query builder. |
| 5 | Payment status read test. | `still missing` | `PaymentStatusReader` exists as an interface, and payment command/status update tests exist, but I did not find a direct payment-status reader test. |
| 5 | Forbidden-role test: supplier or guest cannot read PMCM finance payload. | `still missing` | `EventReadModelsService.billing` allows only PMCM/system/client, but I did not find an explicit supplier/guest denial regression for the billing read model. |
| 5 | Supplier and guest payloads do not expose PMCM finance details. | `completed with evidence` | Supplier workspace read-model tests keep supplier payloads supplier-scoped, billing reads require PMCM/system/client, and guest payload tests keep guest payloads role-scoped. Add the explicit supplier/guest finance-denial test above before claiming the broader phase fully proven. |
| 5 | Billing audit rows include correlation id and actor. | `still missing` | `BillingOperationsService` audit calls include actor role/name, but I did not find correlation-id propagation in billing audit metadata. This needs implementation or an explicit design deferral. |
| 6 | Add schema and route evidence for PMCM and client file requirements. | `covered by later phase` | `apps/api/libs/modules/file-ops/src/controllers/event-file-requirements.controller.test.ts` covers PMCM-visible requirements, client role filtering, missing event, and denied access. |
| 6 | Update read models to consume file reader ports. | `deferred by design` | The implemented route ownership puts file requirements behind `FileOpsModule` directly; the PMCM/client workspace read models do not yet embed file matrix payloads. Treat as future hardening unless route/workspace contracts require embedded file data. |
| 6 | Forbidden-role test for supplier/guest access to client-only files. | `still missing` | Guest denied access is tested in `event-file-requirements.controller.test.ts`; I did not find the supplier-specific denial/visibility test for client-only file rows. |
| 6 | File requirement writes live in `file-ops`. | `deferred by design` | File writes are intentionally metadata-only/gated. `FileOpsModule` exposes `FILE_REQUIREMENT_COMMANDS` as metadata-only and real storage/upload write behavior remains out of scope without an approved storage adapter plan. |
| 7A | Add forbidden-role test for unauthenticated access beyond public inquiry creation. | `still missing` | Public inquiry privacy-consent tests exist, but I did not find an explicit unauthenticated-access denial test for non-public inquiry/onboarding routes. |
| 7B | Add briefing reader port when briefing ownership moves out of `inquiry-onboarding`/`event-ops`. | `deferred by design` | Briefing command route ownership moved to `inquiry-onboarding`; a separate briefing reader port is only needed when briefing read ownership moves. |
| 7B | Test full proposal document workflow and conforme readiness when proposal generation exists. | `deferred by design` | Proposal document generation is not implemented/approved in this refactor; `commercial-ops` owns quote/proposal workflow tokens and supplier quote decisions only. |

## Phase 9 Child Plan Open Boxes

The Phase 9 master section is checked, but `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith-phase-9-guest-ops.md` still has stale unchecked task boxes. Classification below is based on current code and tests.

| Child plan line / item | Classification | Evidence / action |
| --- | --- | --- |
| Task 1 Step 1: Write focused guest workflow tests. | `completed with evidence` | `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.test.ts` exists. |
| Task 1 Step 2: Run baseline test and accept expected failure before the module exists. | `covered by later phase` | Stale TDD setup step; module now exists and final tests pass. Do not try to reproduce the pre-implementation failure. |
| Task 2 Step 1: Add guest provider tokens. | `completed with evidence` | `apps/api/libs/modules/guest-ops/src/ports/guest-ops.tokens.ts` defines `GUEST_COMMANDS` and `GUEST_READER`. |
| Task 2 Step 2: Add command and reader interfaces. | `completed with evidence` | `guest-commands.port.ts` and `guest-reader.port.ts` exist. |
| Task 2 Step 3: Move and extend `GuestWorkflowService`. | `completed with evidence` | `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.ts` owns guest workflow and reader methods. |
| Task 2 Step 4: Keep legacy imports stable. | `completed with evidence` | Event-ops imports `GuestWorkflowService` from `@prism/modules/guest-ops`; compatibility paths are no longer private owners. |
| Task 2 Step 5: Register module bindings. | `completed with evidence` | `GuestOpsModule` provides/exports `GuestWorkflowService`, `GUEST_COMMANDS`, and `GUEST_READER`. |
| Task 2 Step 6: Run focused guest workflow tests. | `completed with evidence` | Covered by the passing `guest` Vitest pattern in the broad command. |
| Task 3 Step 1: Import `GuestOpsModule` in event-ops. | `completed with evidence` | `EventOpsModule` imports `GuestOpsModule` through current module wiring. |
| Task 3 Step 2: Import guest service and types from public guest module. | `completed with evidence` | `event-ops.service.test.ts` and runtime services import guest service from `@prism/modules/guest-ops`. |
| Task 3 Step 3: Remove local guest provider ownership. | `completed with evidence` | Guest provider ownership lives in `GuestOpsModule`; boundary checks passed. |
| Task 3 Step 4: Replace direct guest queries in route facade methods. | `completed with evidence` | Guest reads route through guest service/reader methods such as `listCheckInsForEvent`, `listFeedbackForEvent`, and payload mappers. |
| Task 3 Step 5: Add forbidden-role regression for guest access. | `completed with evidence` | Event-ops tests include role-denial regressions for guest/PMCM payload boundaries. |
| Task 3 Step 6: Run event-ops guest tests. | `completed with evidence` | Covered by the passing `guest` Vitest pattern and prior focused event-ops test runs. |
| Task 4 Step 1: Inject the `GUEST_READER` port. | `completed with evidence` | `EventReadModelsService` injects `GUEST_READER`. |
| Task 4 Step 2: Add guest data to PMCM event workspace. | `completed with evidence` | `EventReadModelsService` fetches guest check-ins/feedback through the guest reader for PMCM event workspace. |
| Task 4 Step 3: Keep guest payloads role-scoped. | `completed with evidence` | Guest payload tests and read-model tests keep guest/client/supplier/PMCM payloads scoped. |
| Task 4 Step 4: Update tests with a guest reader mock. | `completed with evidence` | `event-read-models.service.test.ts` has guest reader mocks. |
| Task 4 Step 5: Add port-consumption assertion. | `completed with evidence` | `event-read-models.service.test.ts` asserts guest reader calls for PMCM workspace. |
| Task 4 Step 6: Run read-model tests. | `completed with evidence` | Read-model tests have passed in previous Phase 11 verification and boundary/build runs continue to pass. |
| Task 5 Step 1: Add TypeScript path aliases. | `completed with evidence` | Guest module imports resolve in API build. |
| Task 5 Step 2: Add Vitest alias. | `completed with evidence` | Guest tests resolve and pass under Vitest. |
| Task 5 Step 3: Add Nest library project. | `completed with evidence` | API build passes with guest module present. |
| Task 5 Step 4: Run build. | `completed with evidence` | `npm --workspace prism-api run build` passed elevated. |
| Task 6 Step 1: Mark Phase 9 complete in the master plan. | `completed with evidence` | Master plan Phase 9 is checked. |
| Task 6 Step 2: Update architecture and current-state docs. | `completed with evidence` | `docs/prism-v4/15-system-architecture.md` and `17-current-state-2026-06-20.md` include guest-ops extraction notes. |
| Task 6 Step 3: Run final verification. | `completed with evidence` | Current broad `supplier billing file guest` tests, API build, and boundary check pass. |
| Task 6 Step 4: Commit implementation. | `completed with evidence` | The master plan records `refactor(api): extract guest operations module`; current branch history contains the completed extracted module state. |

## Completion Impact

Before the overall backend modular monolith goal can be claimed complete, resolve or explicitly defer these unresolved items:

| Priority | Item |
| --- | --- |
| P1 | Add explicit client/guest denial test for supplier assignment mutation or mark the exact policy coverage as sufficient. |
| P1 | Decide whether supplier readiness reads must use `SupplierReadinessReader`; current read-model query-builder behavior is not the same as port consumption. |
| P1 | Add payment-status reader test or remove/defer the unused `PaymentStatusReader` target. |
| P1 | Add explicit supplier/guest denial test for PMCM finance payload reads. |
| P1 | Decide whether billing audit rows must carry correlation ids now; actor metadata exists, correlation-id evidence is missing. |
| P2 | Add supplier-specific file requirements denial/visibility test for client-only file rows. |
| P2 | Add unauthenticated/non-public inquiry-onboarding denial regression. |
| Deferred | File requirement writes, embedded file-reader read-model consumption, briefing reader port, and full proposal document workflow are design-deferred unless those capabilities are approved. |
