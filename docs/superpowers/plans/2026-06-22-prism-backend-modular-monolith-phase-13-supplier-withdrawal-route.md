# Prism Supplier Withdrawal Route Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the PMCM supplier quote-request withdrawal route out of the `event-ops` compatibility controller and into `supplier-ops` without changing the public `/events/:eventId/quote-requests/:requestId/withdraw` path.

**Architecture:** Supplier quote-request withdrawal is a supplier lifecycle command, so route ownership belongs in `supplier-ops` beside `SupplierNetworkWorkflowService`. The controller resolves the route actor through `EventAccessPolicyService`, delegates to `SupplierNetworkWorkflowService.withdrawSupplier`, and keeps the existing default withdrawal reason. `event-ops` keeps only defense-readiness under its `events` compatibility controller after this slice.

**Tech Stack:** NestJS controllers/providers, existing `SupplierNetworkWorkflowService`, existing `EventAccessPolicyService`, Vitest controller delegation tests, `npm --workspace prism-api run build`, `npm run check:boundaries`.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend controller ownership aligned to capability modules for route-safe supplier lifecycle commands. |
| Feature-ledger row | Supplier reliability and supplier quote request lifecycle, plus event-day operational recovery after supplier withdrawal. |
| Route/app/actor | PMCM event command app route: `PATCH /events/:eventId/quote-requests/:requestId/withdraw`. |
| Contract touched | Route ownership only. Public path, body field `reason`, actor query fields, and response shape stay stable. |
| Fallback state | `event-ops` keeps `/events/:eventId/defense-readiness` and `/sample/*` after this slice. |
| Forbidden-role test | Supplier workflow route delegates into `SupplierNetworkWorkflowService`, whose `requireSupplierAdmin` policy allows PMCM/system actors only. Existing supplier workflow tests plus controller delegation test cover the route entrypoint. |
| Query budget | Not applicable for this command route. |
| Side-effect mode | Existing supplier withdrawal workflow: supplier assignment update, audit side effect, and asynchronous PARE trigger side effect. |
| Route-smoke evidence | Controller metadata/delegation test for `OpsEventSupplierWithdrawalController`; focused supplier workflow/event-ops tests; API build; boundary check. |
| Docs updated | This child plan, master backend modular monolith plan, `docs/prism-v4/07-implemented-feature-revisions.md`, `docs/prism-v4/15-system-architecture.md`, and `docs/prism-v4/17-current-state-2026-06-20.md`. |

## File Structure

| Path | Responsibility |
| --- | --- |
| `apps/api/libs/modules/supplier-ops/src/controllers/event-supplier-withdrawal.controller.ts` | Own the existing PMCM `/events/:eventId/quote-requests/:requestId/withdraw` route and delegate to supplier workflow. |
| `apps/api/libs/modules/supplier-ops/src/controllers/event-supplier-withdrawal.controller.test.ts` | Assert route base path and delegation signatures, including default/custom reason and actor resolution. |
| `apps/api/libs/modules/supplier-ops/src/supplier-ops.module.ts` | Register the new withdrawal controller. |
| `apps/api/libs/modules/supplier-ops/src/index.ts` | Export the new controller for compatibility imports if needed. |
| `apps/api/libs/modules/event-ops/src/controllers/events.controller.ts` | Remove the supplier withdrawal route, leaving only defense-readiness compatibility. |
| `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md` | Record supplier withdrawal route ownership progress. |
| `docs/prism-v4/07-implemented-feature-revisions.md` | Update current backend revision pressure summary. |
| `docs/prism-v4/15-system-architecture.md` | Update current controller ownership and remaining event-ops route list. |
| `docs/prism-v4/17-current-state-2026-06-20.md` | Add/update post-snapshot route ownership note. |

## Task 1 - Add Supplier-Owned Withdrawal Controller

**Files:**
- Create: `apps/api/libs/modules/supplier-ops/src/controllers/event-supplier-withdrawal.controller.ts`
- Create: `apps/api/libs/modules/supplier-ops/src/controllers/event-supplier-withdrawal.controller.test.ts`

- [x] **Step 1: Write the route delegation test**

Create `event-supplier-withdrawal.controller.test.ts` with assertions for base path `events`, default reason, custom reason, and actor resolution:

```ts
import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { OpsEventSupplierWithdrawalController } from './event-supplier-withdrawal.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const actor = { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true };
  const eventAccessPolicyService = {
    resolveActor: vi.fn(() => actor),
  };
  const supplierNetworkWorkflowService = {
    withdrawSupplier: vi.fn(async () => ({ id: 'qr_sample' })),
  };
  return {
    actor,
    controller: new OpsEventSupplierWithdrawalController(
      supplierNetworkWorkflowService as any,
      eventAccessPolicyService as any,
    ),
    eventAccessPolicyService,
    supplierNetworkWorkflowService,
  };
}

describe('OpsEventSupplierWithdrawalController', () => {
  it('keeps the event route base path stable', () => {
    expect(controllerPath(OpsEventSupplierWithdrawalController)).toBe('events');
  });

  it('delegates supplier withdrawal with the default reason', async () => {
    const { actor, controller, eventAccessPolicyService, supplierNetworkWorkflowService } = createController();
    const actorQuery = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'PMCM Admin' };

    await controller.withdrawSupplier('evt_sample', 'qr_sample', {}, actorQuery as any);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith(actorQuery);
    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Withdrawn by PMCM Admin',
      actor,
    );
  });

  it('delegates supplier withdrawal with a custom reason', async () => {
    const { actor, controller, supplierNetworkWorkflowService } = createController();

    await controller.withdrawSupplier(
      'evt_sample',
      'qr_sample',
      { reason: 'Supplier unavailable' },
      { actorRole: OpsUserRole.PmcmAdmin } as any,
    );

    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Supplier unavailable',
      actor,
    );
  });
});
```

- [x] **Step 2: Add the supplier-owned controller**

Create `event-supplier-withdrawal.controller.ts`:

```ts
import { Body, Controller, Param, Patch, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { SupplierActorDto } from '../dto/supplier.dto';
import { SupplierNetworkWorkflowService } from '../services/supplier-network-workflow.service';

@Controller('events')
export class OpsEventSupplierWithdrawalController {
  constructor(
    private readonly supplierNetworkWorkflowService: SupplierNetworkWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch(':eventId/quote-requests/:requestId/withdraw')
  withdrawSupplier(
    @Param('eventId') _eventId: string,
    @Param('requestId') requestId: string,
    @Body() dto: { reason?: string } = {},
    @Query() actorInput: SupplierActorDto,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    return this.supplierNetworkWorkflowService.withdrawSupplier(
      requestId,
      dto.reason ?? 'Withdrawn by PMCM Admin',
      actor,
    );
  }
}
```

- [x] **Step 3: Run the controller test**

Run: `npm --workspace prism-api run test -- event-supplier-withdrawal.controller.test.ts`

Expected: PASS.

## Task 2 - Register Controller And Shrink Event-Ops Events Controller

**Files:**
- Modify: `apps/api/libs/modules/supplier-ops/src/supplier-ops.module.ts`
- Modify: `apps/api/libs/modules/supplier-ops/src/index.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/events.controller.ts`

- [x] **Step 1: Register and export the supplier-owned event withdrawal controller**

Add `OpsEventSupplierWithdrawalController` to `SupplierOpsModule.controllers` and export it from `supplier-ops/src/index.ts`.

- [x] **Step 2: Remove supplier withdrawal from event-ops events controller**

`apps/api/libs/modules/event-ops/src/controllers/events.controller.ts` should keep only defense-readiness:

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { SampleActorDto } from '../dto/event-ops.dto';
import { EventOpsService } from '../event-ops.service';

@Controller('events')
export class OpsEventsController {
  constructor(private readonly eventOpsService: EventOpsService) {}

  @Get(':eventId/defense-readiness')
  defenseReadiness(@Param('eventId') eventId: string, @Query() actor: SampleActorDto) {
    return this.eventOpsService.getDefenseReadiness(eventId, actor);
  }
}
```

- [x] **Step 3: Run focused route tests**

Run: `npm --workspace prism-api run test -- event-supplier-withdrawal.controller.test.ts controller-routes.test.ts supplier-network-workflow.service.test.ts event-ops.service.test.ts`

Expected: PASS.

## Task 3 - Docs, Verification, And Commit

**Files:**
- Modify docs listed in the evidence gate.

- [x] **Step 1: Update docs**

Record that `/events/:eventId/quote-requests/:requestId/withdraw` is now registered by `SupplierOpsModule`, while `event-ops` keeps defense-readiness and sample compatibility.

- [x] **Step 2: Run build and boundary check**

Run:

```powershell
npm --workspace prism-api run build
npm run check:boundaries
```

Expected: API build succeeds and boundary check passes.

- [x] **Step 3: Commit**

```powershell
git add -- apps/api/libs/modules/supplier-ops apps/api/libs/modules/event-ops docs/prism-v4 docs/superpowers/plans
git commit -m "refactor(api): move supplier withdrawal route"
```

## Self-Review

- Spec coverage: This plan moves only the supplier withdrawal route, preserves its public path and body/query shape, and leaves defense-readiness in event-ops for a later slice.
- Placeholder scan: No task uses TBD/TODO placeholders; every file and command is concrete.
- Type consistency: The controller uses `EventAccessPolicyService.resolveActor` before calling `SupplierNetworkWorkflowService.withdrawSupplier`, matching the workflow service's `ResolvedEventOpsActor` requirement.
