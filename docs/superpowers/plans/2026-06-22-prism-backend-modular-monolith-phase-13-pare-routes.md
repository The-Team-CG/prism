# Prism PARE Route Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move PARE automation and HTTP route ownership out of the `event-ops` compatibility controller without changing the public `/ai/pare/*` route paths.

**Architecture:** PARE analysis and approval state belong in `ai-governance` because they write AI audit and approval records. Manual PARE trigger remains a supplier emergency workflow, so the `/ai/pare/*` controller moves to `supplier-ops` and delegates to `SupplierNetworkWorkflowService`, which consumes `PAREService` through the existing `SUPPLIER_PARE_AUTOMATION` port. `event-ops` keeps no PARE controller registration after this slice.

**Tech Stack:** NestJS modules/controllers/providers, PrismaService, existing `SupplierNetworkWorkflowService`, `PAREService`, `SUPPLIER_PARE_AUTOMATION`, Vitest, `npm --workspace prism-api run build`, `npm run check:boundaries`.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend controller ownership aligned to capability modules for route-safe AI/supplier emergency workflow contracts. |
| Feature-ledger row | Supplier reliability/PARE emergency replacement, AI governance approval records, event-day operational recovery. |
| Route/app/actor | PMCM event command app routes: `POST /ai/pare/trigger/:requestId`, `GET /ai/pare/pending`, `PATCH /ai/pare/:approvalRecordId/approve`, `PATCH /ai/pare/:approvalRecordId/reject`. |
| Contract touched | Route ownership only. Public paths, query names, and response shapes stay stable. No API-client package change is expected. |
| Fallback state | `event-ops` keeps `/sample/*`, `/events/:eventId/defense-readiness`, and `/events/:eventId/quote-requests/:requestId/withdraw` after this slice. |
| Forbidden-role test | PARE approval routes remain PMCM/system operational actions. Existing supplier workflow PARE tests plus route delegation tests prove route entrypoints do not bypass supplier workflow. |
| Query budget | PARE pending reads use the existing `opsAiApprovalRecord.findMany` plus per-record audit hydration. No new per-row route loop is introduced by the controller move. |
| Side-effect mode | Manual PARE trigger uses existing supplier withdrawal workflow side effects; PARE approvals update AI approval/audit state and write supplier audit decision metadata. |
| Route-smoke evidence | Controller metadata/delegation tests for `OpsSupplierPareController`; PARE service tests; supplier workflow tests; event-ops controller registry shrink test. |
| Docs updated | This child plan, master backend modular monolith plan, `docs/prism-v4/07-implemented-feature-revisions.md`, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## File Structure

| Path | Responsibility |
| --- | --- |
| `apps/api/libs/modules/ai-governance/src/services/pare/*` | Own PARE agents, sanitizer, types, service, and service tests. |
| `apps/api/libs/modules/ai-governance/src/ai-governance.module.ts` | Register and export `PAREService` alongside `AiGovernanceService`. |
| `apps/api/libs/modules/ai-governance/src/index.ts` | Export PARE service/types for capability consumers and compatibility re-exports. |
| `apps/api/libs/modules/event-ops/src/services/pare/pare.service.ts` | Compatibility re-export to the new PARE service path. |
| `apps/api/libs/modules/event-ops/src/services/pare/pare.types.ts` | Compatibility re-export to the new PARE types path. |
| `apps/api/libs/modules/supplier-ops/src/controllers/supplier-pare.controller.ts` | Own `/ai/pare/*` route methods and delegate to supplier workflow. |
| `apps/api/libs/modules/supplier-ops/src/controllers/supplier-pare.controller.test.ts` | Assert route base and delegation signatures. |
| `apps/api/libs/modules/supplier-ops/src/supplier-ops.module.ts` | Import `AiGovernanceModule`, alias `SUPPLIER_PARE_AUTOMATION` to exported `PAREService`, and register PARE controller. |
| `apps/api/libs/modules/event-ops/src/controllers/ai.controller.ts` | Compatibility re-export only; no local decorated controller. |
| `apps/api/libs/modules/event-ops/src/controllers/index.ts` | Remove `OpsAiController` from `EVENT_OPS_CONTROLLERS`. |
| `apps/api/libs/modules/event-ops/src/controllers/controller-routes.test.ts` | Expect only `events` and `sample` in the event-ops registry. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Remove event-ops-local `PAREService` provider and alias supplier PARE token to imported `PAREService` only while withdrawal remains in event-ops. |
| `apps/api/libs/modules/event-ops/src/event-ops.service.ts` | Remove unused `PAREService` constructor injection. |

## Task 1 - Move PARE Automation To AI Governance

**Files:**
- Move: `apps/api/libs/modules/event-ops/src/services/pare/data-sanitizer.service.ts`
- Move: `apps/api/libs/modules/event-ops/src/services/pare/agents/*.ts`
- Move: `apps/api/libs/modules/event-ops/src/services/pare/pare.service.ts`
- Move: `apps/api/libs/modules/event-ops/src/services/pare/pare.types.ts`
- Move: `apps/api/libs/modules/event-ops/src/services/pare/pare.service.test.ts`
- Create compatibility re-exports in old `event-ops/src/services/pare` path.
- Modify: `apps/api/libs/modules/ai-governance/src/ai-governance.module.ts`
- Modify: `apps/api/libs/modules/ai-governance/src/index.ts`

- [x] **Step 1: Move PARE files into `ai-governance/src/services/pare`**

Move the implementation files and tests so their relative imports remain valid:

```powershell
New-Item -ItemType Directory -Force -Path apps/api/libs/modules/ai-governance/src/services/pare/agents
Move-Item apps/api/libs/modules/event-ops/src/services/pare/data-sanitizer.service.ts apps/api/libs/modules/ai-governance/src/services/pare/data-sanitizer.service.ts
Move-Item apps/api/libs/modules/event-ops/src/services/pare/pare.service.ts apps/api/libs/modules/ai-governance/src/services/pare/pare.service.ts
Move-Item apps/api/libs/modules/event-ops/src/services/pare/pare.types.ts apps/api/libs/modules/ai-governance/src/services/pare/pare.types.ts
Move-Item apps/api/libs/modules/event-ops/src/services/pare/pare.service.test.ts apps/api/libs/modules/ai-governance/src/services/pare/pare.service.test.ts
Move-Item apps/api/libs/modules/event-ops/src/services/pare/agents/*.ts apps/api/libs/modules/ai-governance/src/services/pare/agents/
```

- [x] **Step 2: Leave compatibility re-exports in old event-ops PARE path**

Replace old-path service/type files with:

```ts
export * from '@prism/modules/ai-governance';
```

- [x] **Step 3: Register and export PAREService from AI governance**

`apps/api/libs/modules/ai-governance/src/ai-governance.module.ts` must import `PAREService`, add it to `providers`, and export it:

```ts
providers: [AiGovernanceService, PAREService],
exports: [AiGovernanceService, PAREService],
```

`apps/api/libs/modules/ai-governance/src/index.ts` must export:

```ts
export * from './services/pare/pare.service';
export * from './services/pare/pare.types';
```

- [x] **Step 4: Run PARE service tests**

Run: `npm --workspace prism-api run test -- pare.service.test.ts`

Expected: PASS.

## Task 2 - Wire Supplier PARE Port To AI Governance

**Files:**
- Modify: `apps/api/libs/modules/supplier-ops/src/supplier-ops.module.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`

- [x] **Step 1: Use AI governance PARE in supplier-ops**

Import `AiGovernanceModule` and `PAREService`, remove the unsupported PARE stub provider, and alias `SUPPLIER_PARE_AUTOMATION` with a factory:

```ts
{ provide: SUPPLIER_PARE_AUTOMATION, useFactory: (pareService: PAREService) => pareService, inject: [PAREService] }
```

- [x] **Step 2: Keep event-ops withdrawal compatibility wired while withdrawal remains there**

Import `PAREService` from `@prism/modules/ai-governance`, remove the old local PARE import/provider, and keep the local supplier workflow PARE token alias with the same factory shape.

- [x] **Step 3: Remove unused EventOpsService PARE constructor injection**

Delete the `private readonly pareService: PAREService` constructor argument and the old PARE import from `event-ops.service.ts`.

- [x] **Step 4: Run supplier PARE workflow tests**

Run: `npm --workspace prism-api run test -- supplier-network-workflow.service.test.ts pare.service.test.ts event-ops.service.test.ts`

Expected: PASS.

## Task 3 - Move `/ai/pare/*` Routes To Supplier-Ops

**Files:**
- Create: `apps/api/libs/modules/supplier-ops/src/controllers/supplier-pare.controller.ts`
- Create: `apps/api/libs/modules/supplier-ops/src/controllers/supplier-pare.controller.test.ts`
- Modify: `apps/api/libs/modules/supplier-ops/src/supplier-ops.module.ts`
- Modify: `apps/api/libs/modules/supplier-ops/src/index.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/ai.controller.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/index.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/controller-routes.test.ts`

- [x] **Step 1: Create supplier-owned PARE controller**

Create `OpsSupplierPareController` with base `@Controller('ai')` and these methods:

```ts
@Post('pare/trigger/:requestId')
@HttpCode(HttpStatus.CREATED)
pareManualTrigger(@Param('requestId') requestId: string) {
  return this.supplierNetworkWorkflowService.withdrawSupplier(requestId, 'Manual PARE trigger via API', {
    role: OpsUserRole.PmcmAdmin,
    name: 'PMCM Admin',
    explicit: true,
  });
}

@Get('pare/pending')
pareGetPending(@Query('eventId') eventId?: string) {
  return this.supplierNetworkWorkflowService.pareGetPendingApprovals(eventId);
}

@Patch('pare/:approvalRecordId/approve')
pareApprove(@Param('approvalRecordId') approvalRecordId: string, @Query('approvedBy') approvedBy = 'PMCM Admin') {
  return this.supplierNetworkWorkflowService.pareApprove(approvalRecordId, approvedBy);
}

@Patch('pare/:approvalRecordId/reject')
pareReject(@Param('approvalRecordId') approvalRecordId: string, @Query('rejectedBy') rejectedBy = 'PMCM Admin') {
  return this.supplierNetworkWorkflowService.pareReject(approvalRecordId, rejectedBy);
}
```

- [x] **Step 2: Register and export the controller**

Add `OpsSupplierPareController` to `SupplierOpsModule.controllers` and export it from `supplier-ops/src/index.ts`.

- [x] **Step 3: Make event-ops AI controller compatibility-only**

Replace `event-ops/src/controllers/ai.controller.ts` with:

```ts
export { OpsSupplierPareController as OpsAiController } from '@prism/modules/supplier-ops';
```

Remove `OpsAiController` from `EVENT_OPS_CONTROLLERS`, leaving only `events` and `sample`.

- [x] **Step 4: Add route smoke tests**

Add a controller test that verifies base path `ai` and delegation arguments for trigger, pending, approve, and reject.

- [x] **Step 5: Run route tests**

Run: `npm --workspace prism-api run test -- supplier-pare.controller.test.ts controller-routes.test.ts`

Expected: PASS.

## Task 4 - Docs, Verification, And Commit

**Files:**
- Modify docs listed in the evidence gate.

- [x] **Step 1: Update docs**

Record that PARE automation lives in `ai-governance`, `/ai/pare/*` route ownership lives in `supplier-ops`, and `event-ops` now registers only `events` and `sample` compatibility controllers.

- [x] **Step 2: Run focused tests**

Run:

```powershell
npm --workspace prism-api run test -- supplier-pare.controller.test.ts pare.service.test.ts supplier-network-workflow.service.test.ts event-ops.service.test.ts controller-routes.test.ts
```

Expected: all listed files pass.

- [x] **Step 3: Run build and boundary check**

Run:

```powershell
npm --workspace prism-api run build
npm run check:boundaries
```

Expected: API build succeeds and boundary check passes for all tracked app/package files.

- [x] **Step 4: Commit**

```powershell
git add -- apps/api/libs/modules/ai-governance apps/api/libs/modules/supplier-ops apps/api/libs/modules/event-ops docs/prism-v4 docs/superpowers/plans
git commit -m "refactor(api): move pare routes to supplier ops"
```

## Self-Review

- Spec coverage: This plan moves the remaining `/ai/pare/*` route family out of `event-ops`, moves the PARE implementation out of `event-ops`, preserves route paths, and keeps supplier withdrawal behavior in supplier workflow.
- Placeholder scan: No task uses TBD/TODO placeholders; every command and expected verification is explicit.
- Type consistency: Controller methods call existing `SupplierNetworkWorkflowService` methods with resolved PMCM actor context; PARE service/types keep their existing names and response shapes.
