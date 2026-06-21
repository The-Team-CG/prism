# Prism Backend Modular Monolith Phase 1 DI Child Plan

> Parent plan: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`

**Phase:** Phase 1 - Dependency Injection Foundation Inside `event-ops`

**Goal:** Replace manual service construction inside `EventOpsService` with Nest provider construction while preserving current routes, method names, behavior, and tests.

**Owner D system goal:** Anthony makes platform behavior trustworthy by turning the current hidden service graph into an explicit Nest provider graph. This is a prerequisite for later module extraction, role-boundary tests, audit/outbox consistency, and stable app contracts.

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Platform trust through explicit backend dependency ownership. |
| Feature-ledger row | FL-014 notifications, FL-015 audit/privacy/security, FL-024 file requirements, plus backend support for FL-001 through FL-013 route-safe workflows. |
| Route/app/actor | Existing `apps/api` event-ops routes for PMCM, client, supplier, guest, public inquiry, and sample compatibility. No public route path changes. |
| Contract touched | None expected. `packages/types` and `packages/api-client` should not change in this phase. |
| Fallback state | `/api/sample/state` remains compatibility-only. No fallback removal in this phase. |
| Forbidden-role test | Existing event-ops role/policy tests must keep passing; no new route authorization semantics are introduced. |
| Query budget | Not applicable. This phase changes provider construction, not read query shape. |
| Side-effect mode | Existing behavior preserved. Audit/outbox side-effect semantics are not changed until Phase 2. |
| Route-smoke evidence | `npm --workspace prism-api run test:event-ops` and `npm --workspace prism-api run build`. |
| Docs updated | Parent plan checkbox updated; child plan kept as execution record. |

## Current Service Graph

`EventOpsService` currently constructs this graph in its constructor:

| Field | Current construction | Phase 1 target |
| --- | --- | --- |
| `sampleStateService` | `new SampleStateService(prisma)` | Inject `SampleStateService`. |
| `inquiryWorkflowService` | `new InquiryWorkflowService(prisma)` | Inject `InquiryWorkflowService`. |
| `auditService` | `new AuditService(prisma)` | Inject `AuditService`. |
| `eventAccessPolicyService` | `new EventAccessPolicyService(auditService)` | Inject `EventAccessPolicyService`. |
| `notificationOutboxService` | `new NotificationOutboxService(prisma)` | Inject `NotificationOutboxService`. |
| `workflowCommandService` | `new WorkflowCommandService()` | Inject `WorkflowCommandService`. |
| `aiGovernanceService` | `new AiGovernanceService(prisma)` | Inject `AiGovernanceService`. |
| `inquiriesService` | `new InquiriesService(prisma, audit, outbox, workflow)` | Inject `InquiriesService`. |
| `authOperationsService` | `new AuthOperationsService(prisma, audit, inquiries)` | Inject `AuthOperationsService`. |
| `privacyOperationsService` | `new PrivacyOperationsService(prisma, audit)` | Inject `PrivacyOperationsService`. |
| `coordinatorsService` | `new CoordinatorsService(prisma, audit, outbox, workflow)` | Inject `CoordinatorsService`. |
| `liveOperationsService` | `new LiveOperationsService(prisma, audit, outbox, workflow)` | Inject `LiveOperationsService`. |
| `suppliersService` | `new SuppliersService(prisma)` | Inject `SuppliersService`. |
| `pareService` | `new PAREService(prisma)` | Inject `PAREService`. |
| `documentVaultService` | `new DocumentVaultService()` | Inject `DocumentVaultService`. |
| `supplierNetworkWorkflowService` | `new SupplierNetworkWorkflowService(...)` | Inject `SupplierNetworkWorkflowService`. |
| `eventLifecycleService` | `new EventLifecycleService()` | Inject `EventLifecycleService`. |
| `fileRequirementsMatrixService` | `new FileRequirementsMatrixService(prisma)` | Inject `FileRequirementsMatrixService`. |
| `floorPlanWorkflowService` | `new FloorPlanWorkflowService(prisma, audit, outbox, workflow)` | Inject `FloorPlanWorkflowService`. |
| `billingOperationsService` | `new BillingOperationsService(prisma, audit, outbox, workflow)` | Inject `BillingOperationsService`. |
| `eventReadModelsService` | `new EventReadModelsService(prisma, policy, suppliers)` | Inject `EventReadModelsService`. |
| `commercialWorkflowService` | `new CommercialWorkflowService(prisma, audit, outbox, workflow, suppliers)` | Inject `CommercialWorkflowService`. |
| `eventClosureService` | `new EventClosureService(...)` | Inject `EventClosureService`. |
| `complianceWorkflowService` | `new ComplianceWorkflowService(prisma, audit, policy, workflow)` | Inject `ComplianceWorkflowService`. |
| `clientOnboardingWorkflowService` | `new ClientOnboardingWorkflowService(prisma, audit, outbox, workflow)` | Inject `ClientOnboardingWorkflowService`. |
| `guestWorkflowService` | `new GuestWorkflowService(prisma, audit, workflow, documentVault)` | Inject `GuestWorkflowService`. |

## Files To Edit

| File | Planned change |
| --- | --- |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Register the full provider graph in explicit dependency order. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Replace private field declarations and manual constructor body with constructor-injected services. |
| `apps/api/libs/modules/event-ops/src/services/*.service.ts` | Add `@Injectable()` where missing and remove default-created dependencies for services Nest will construct. |
| `apps/api/libs/modules/event-ops/src/services/pare/pare.service.ts` | Leave internal PARE agent construction unchanged unless Nest provider resolution requires otherwise. |
| Existing service tests | Update only where default dependency removal breaks direct construction tests. Prefer explicit fake dependencies over new implicit defaults. |

## Step 1 - Decorators And Imports

- [x] Add `import { Injectable } from '@nestjs/common';` to missing service files that Nest will construct.
- [x] Add `@Injectable()` directly above each missing provider class.
- [x] Do not add decorators to pure PARE agent classes unless they become Nest providers.

Missing or likely missing decorators from current inspection:

- [x] `AuditService`
- [x] `AuthOperationsService`
- [x] `BillingOperationsService`
- [x] `ClientOnboardingWorkflowService`
- [x] `CommercialWorkflowService`
- [x] `CoordinatorsService`
- [x] `EventAccessPolicyService`
- [x] `EventLifecycleService`
- [x] `EventReadModelsService`
- [x] `FileRequirementsMatrixService`
- [x] `FloorPlanWorkflowService`
- [x] `GuestWorkflowService`
- [x] `InquiriesService`
- [x] `LiveOperationsService`
- [x] `NotificationOutboxService`
- [x] `PrivacyOperationsService`
- [x] `SuppliersService`
- [x] `WorkflowCommandService`

Already decorated from current inspection:

- `AiGovernanceService`
- `ComplianceWorkflowService`
- `DocumentVaultService`
- `EventClosureService`
- `InquiryWorkflowService`
- `PAREService`
- `SampleStateService`
- `SupplierNetworkWorkflowService`

## Step 2 - Remove Default-Created Shared Dependencies

- [x] `BillingOperationsService`: require injected `AuditService`, `NotificationOutboxService`, and `WorkflowCommandService`.
- [x] `CoordinatorsService`: require injected `AuditService`, `NotificationOutboxService`, and `WorkflowCommandService`.
- [x] `FloorPlanWorkflowService`: require injected `AuditService`, `NotificationOutboxService`, and `WorkflowCommandService`.
- [x] `InquiriesService`: require injected `NotificationOutboxService` and `WorkflowCommandService`.
- [x] `LiveOperationsService`: require injected `PrismaService`, `AuditService`, `NotificationOutboxService`, and `WorkflowCommandService`.
- [x] `GuestWorkflowService`: require injected `DocumentVaultService`.
- [x] `SupplierNetworkWorkflowService`: require injected `DocumentVaultService`.

Do not change audit/outbox behavior in this phase; only stop constructing duplicate dependency instances.

## Step 3 - Register Providers

- [x] Import every service provider in `event-ops.module.ts`.
- [x] Register providers in an order that mirrors dependencies: primitives/services first, composite workflow services later, `EventOpsService` last.
- [x] Keep `DatabaseModule` as the source of `PrismaService`.
- [x] Do not add `@nestjs/testing` unless a Nest TestingModule test is introduced.

## Step 4 - Inject EventOpsService Dependencies

- [x] Replace private field declarations with constructor parameter properties.
- [x] Remove all `new SomeService(...)` calls from `EventOpsService` constructor.
- [x] Keep `private readonly prisma: PrismaService` injected for lifecycle connect/disconnect behavior.
- [x] Keep all public methods and controller-facing signatures unchanged.

## Step 5 - Tests And Verification

- [x] Run `npm --workspace prism-api run test:event-ops`.
- [x] Run `npm --workspace prism-api run build`.
- [x] Run `npm run check:boundaries`.
- [x] Run `git diff --check`.

If `test:event-ops` is too broad due pre-existing unrelated failures, run the narrow failing slice, document the exact failure, and do not claim Phase 1 complete until the broad event-ops suite is passing or the failure is proven pre-existing.

## Acceptance Criteria

- [x] `EventOpsService` has no manual `new SomeWorkflowService(...)` construction.
- [x] Event-ops module provider graph compiles through Nest build.
- [x] Existing route/controller behavior remains unchanged.
- [x] Tests instantiate services with explicit dependencies where defaults were removed.
- [x] Boundary checker still passes.
- [x] Parent plan Phase 1 checklist is updated only after verification passes.

## Stop Rules

Stop and revise if:

1. Provider registration requires moving files between modules.
2. A service constructor change requires changing route behavior.
3. Tests need broad fixture rewrites unrelated to dependency injection.
4. `PAREService` internal agent construction blocks provider compilation and needs a separate AI-governance child plan.
5. Build requires adding `@nestjs/testing`; that dependency should be introduced only with a test that uses it.