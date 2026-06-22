# Prism Live Ops Controller Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move event-day/live-operations HTTP route ownership out of the `event-ops` compatibility controller into a dedicated `live-ops` capability module without changing public route paths or response payload shapes.

**Architecture:** Create `apps/api/libs/modules/live-ops` as the owner for event-day status reads, event-day task and urgent-issue commands, coordinator event-day role view, coordinator attendance/replacement commands, PMCM supplier status verification, and supplier self-reported event status. Keep PARE and quote-request withdrawal out of this plan because they depend on PARE automation ownership, not live-ops ownership. Avoid a `SupplierOpsModule <-> LiveOpsModule` circular dependency by implementing supplier event-status writes in `live-ops` with supplier public directory/mapper helpers instead of routing through the `SupplierNetworkWorkflowService` instance that is constructed inside `SupplierOpsModule` with an unsupported live-ops stub.

**Tech Stack:** NestJS modules/controllers/providers, PrismaService, existing `EventAccessPolicyService`, `WorkflowCommandService`, `AuditService`, `NotificationOutboxService`, `LiveOperationsService`, `CoordinatorsService`, `GuestWorkflowService`, `FloorPlanWorkflowService`, supplier/public mappers, Vitest, `npm --workspace prism-api run build`, `npm run check:boundaries`.

---

## Owner D Evidence Gate

| Evidence item | Required answer |
| --- | --- |
| Owner D system goal | Backend controller ownership aligned to capability modules for event-day redesign contracts and role-safe live operations. |
| Feature-ledger row | Event-day live operations, coordinator role view, supplier readiness/event-day status, urgent issue escalation, and PMCM status-feed evidence. |
| Route/app/actor | PMCM/coordinator event command app routes: `GET /events/:eventId/live-ops`, `GET /events/:eventId/event-day/status-feed`, task/issue create/update/escalate routes, coordinator attendance/replacement routes, `GET /coordinator/events/:eventId/role-view`; supplier portal route: `PATCH /supplier/quote-requests/:requestId/event-status`; PMCM route: `PATCH /events/:eventId/supplier-status/:requestId/verify`. |
| Contract touched | Route DTO ownership only. Public paths, request fields, and response field names stay stable. No package API-client contract change is expected. |
| Fallback state | `event-ops` keeps `GET /events/:eventId/defense-readiness` and `PATCH /events/:eventId/quote-requests/:requestId/withdraw`; AI PARE remains in the AI compatibility controller until the PARE child plan moves it. |
| Forbidden-role test | Client and guest actors cannot create event-day tasks, mutate urgent issues, update coordinator attendance, verify supplier status, or read coordinator role view. Supplier actors can only update their own selected quote request event status. |
| Query budget | Live-ops read uses one event fetch, one assignment/task/issue/supplier/guest/event-log batch set for the target event, and no per-row Prisma loops. |
| Side-effect mode | Mutating live-ops commands use existing `WorkflowCommandService` semantics: DB mutation first, audit/notification/event-day log side effects after the command write. Supplier event-status records an event-day log after the supplier status update. |
| Route-smoke evidence | Controller metadata/delegation tests for event live-ops, coordinator role-view, and supplier event-status; existing live-operations service tests; focused route/service tests; build; boundary check. |
| Docs updated | This child plan, master backend modular monolith plan, Phase 13 controller ownership plan, `docs/prism-v4/15-system-architecture.md`, `docs/prism-v4/17-current-state-2026-06-20.md`, and `docs/prism-v4/07-implemented-feature-revisions.md`. |

## File Structure

| Path | Responsibility |
| --- | --- |
| `apps/api/libs/modules/live-ops/src/live-ops.module.ts` | Registers live-ops controllers/services and exports `LiveOperationsService` plus `SUPPLIER_LIVE_OPERATIONS`. |
| `apps/api/libs/modules/live-ops/src/controllers/event-live-ops.controller.ts` | Owns `/events/:eventId/live-ops`, `/events/:eventId/event-day/status-feed`, task routes, urgent-issue routes, coordinator attendance/replacement routes, and PMCM supplier status verification. |
| `apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.ts` | Owns `GET /coordinator/events/:eventId/role-view`. |
| `apps/api/libs/modules/live-ops/src/controllers/supplier-live-ops.controller.ts` | Owns `PATCH /supplier/quote-requests/:requestId/event-status`. |
| `apps/api/libs/modules/live-ops/src/dto/live-ops.dto.ts` | Contains live-ops-owned actor and command DTOs copied from the current event-ops DTO contract. |
| `apps/api/libs/modules/live-ops/src/mappers/live-ops.mappers.ts` | Contains response mappers extracted from `EventOpsService` private mapper methods. |
| `apps/api/libs/modules/live-ops/src/services/live-operations.service.ts` | Moved current `LiveOperationsService` implementation; old event-ops service path becomes a compatibility re-export. |
| `apps/api/libs/modules/live-ops/src/services/event-live-ops-read.service.ts` | Owns live-ops reads and coordinator role-view composition. |
| `apps/api/libs/modules/live-ops/src/services/event-live-ops-command.service.ts` | Owns event-day task, urgent issue, coordinator attendance/replacement, supplier verification, and supplier self-report commands. |
| `apps/api/libs/modules/live-ops/src/index.ts` | Public barrel for module, controllers, services, DTOs, and mappers. |
| `apps/api/libs/modules/event-ops/src/services/live-operations.service.ts` | Compatibility re-export: `export * from '@prism/modules/live-ops';`. |
| `apps/api/libs/modules/event-ops/src/controllers/events.controller.ts` | Remove moved live-ops handlers; preserve defense-readiness and quote-request withdrawal handlers. |
| `apps/api/libs/modules/event-ops/src/controllers/coordinator-workspace.controller.ts` | Remove role-view handler; keep only compatibility exports, then remove from `EVENT_OPS_CONTROLLERS`. |
| `apps/api/libs/modules/event-ops/src/controllers/supplier-workspace.controller.ts` | Remove supplier event-status handler, then remove this controller from `EVENT_OPS_CONTROLLERS`. |
| `apps/api/libs/modules/event-ops/src/controllers/index.ts` | Stop registering `OpsCoordinatorWorkspaceController` and `OpsSupplierWorkspaceController` after their last handlers move. |
| `apps/api/libs/modules/event-ops/src/event-ops.module.ts` | Import `LiveOpsModule`; remove event-ops-local `LiveOperationsService` provider and `SUPPLIER_LIVE_OPERATIONS` override if no event-ops provider still requires it. |
| `apps/api/tsconfig.json` and root path aliases if needed | Add `@prism/modules/live-ops` only if module path aliases are explicitly listed there. |

## Task 1 - Lock Current Route Inventory

**Files:**
- Test: `apps/api/libs/modules/event-ops/src/controllers/controller-routes.test.ts`

- [x] **Step 1: Add a failing assertion for remaining event-ops route bases**

Keep the existing route-base assertion and add this explicit comment above it so the next removals are intentional:

```ts
// Live-ops route owners move out of event-ops in the live-ops child plan;
// this registry should shrink when coordinator/supplier compatibility controllers lose their last handlers.
expect(EVENT_OPS_CONTROLLERS.map(controllerPath).sort()).toEqual([
  'ai',
  'coordinator',
  'events',
  'sample',
  'supplier',
]);
```

- [x] **Step 2: Run the inventory test**

Run: `npm --workspace prism-api run test -- controller-routes.test.ts`

Expected before implementation: PASS with the current list. Expected after Task 7: update the expected list to remove `coordinator` and `supplier` if those controllers have no registered handlers.

## Task 2 - Create Live-Ops DTO Ownership

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/dto/live-ops.dto.ts`

- [x] **Step 1: Create DTO file with stable request shapes**

Create this file by copying the currently used live-ops DTOs out of `event-ops.dto.ts`:

```ts
import { IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class UploadMetadataDto {
  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
}
export class LiveOpsActorDto {
  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsIn(['pmcm-admin', 'client', 'supplier', 'coordinator', 'guest', 'system', 'unknown'])
  actorRole?: string;

  @IsOptional()
  @IsEmail()
  actorEmail?: string;

  @IsOptional()
  @IsString()
  actorName?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;
}

export class CreateEventDayTaskDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  assignedRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class UpdateEventDayTaskDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class CreateUrgentIssueDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  openedBy?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class UpdateUrgentIssueDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  slaDueAt?: string;
}

export class EscalateLiveOpsRecordDto {
  @IsOptional()
  @IsString()
  escalationLevel?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  ownerRole?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;
}

export class UpdateCoordinatorAttendanceDto {
  @IsString()
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  markedBy?: string;
}

export class ReplaceCoordinatorAssignmentDto {
  @IsString()
  replacementCoordinatorId!: string;

  @IsString()
  role!: string;

  @IsString()
  reason!: string;
}

export class SupplierEventStatusDto {
  @IsIn(['arrived', 'set_up_ready', 'done_leaving'])
  status!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  photo?: UploadMetadataDto;
}

export class VerifySupplierStatusDto {
  @IsIn(['verified', 'disputed'])
  verificationStatus!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
```

- [x] **Step 2: Run DTO compile check through tests**

Run: `npm --workspace prism-api run test -- controller-routes.test.ts`

Expected: PASS; no live-ops DTO is imported yet.

## Task 3 - Move LiveOperationsService Into Live-Ops

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/services/live-operations.service.ts`
- Modify: `apps/api/libs/modules/event-ops/src/services/live-operations.service.ts`

- [x] **Step 1: Move the existing service implementation**

Move the full current contents of `apps/api/libs/modules/event-ops/src/services/live-operations.service.ts` to `apps/api/libs/modules/live-ops/src/services/live-operations.service.ts` and change these imports:

```ts
import {
  AuditActionType,
  AuditCategory,
  CoordinatorAssignmentStatus,
  CoordinatorAttendanceStatus,
  EventDayTaskStatus,
  LiveOpsEscalationLevel,
  LiveOpsSlaStatus,
  UrgentIssueSeverity,
  UrgentIssueStatus,
  isOpsConstantValue,
  WorkflowCommandService,
} from '@prism/modules/event-core';
import { AuditService } from '@prism/modules/trust-ops';
import { NotificationOutboxService } from '@prism/modules/notification-ops';
```

- [x] **Step 2: Leave compatibility re-export in old path**

Replace `apps/api/libs/modules/event-ops/src/services/live-operations.service.ts` with:

```ts
export * from '@prism/modules/live-ops';
```

- [x] **Step 3: Run service tests**

Run: `npm --workspace prism-api run test -- live-operations.service.test.ts`

Expected: PASS after updating test imports if they import the old path directly.

## Task 4 - Extract Live-Ops Mappers

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/mappers/live-ops.mappers.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`

- [x] **Step 1: Create mapper file**

Extract these private methods from `EventOpsService` into exported functions with the same response shapes:

```ts
export function mapEventDayTask(task: any) {
  return {
    id: task.id,
    eventId: task.eventId,
    title: task.title,
    assignedRole: task.assignedRole,
    ownerName: task.ownerName,
    priority: task.priority,
    status: task.status,
    notes: task.notes,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    slaDueAt: task.slaDueAt ? task.slaDueAt.toISOString() : null,
    slaStatus: task.slaStatus,
    escalationLevel: task.escalationLevel,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

export function mapUrgentIssue(issue: any) {
  return {
    id: issue.id,
    eventId: issue.eventId,
    title: issue.title,
    description: issue.description,
    severity: issue.severity,
    status: issue.status,
    ownerRole: issue.ownerRole,
    ownerName: issue.ownerName,
    openedBy: issue.openedBy,
    resolution: issue.resolution,
    slaDueAt: issue.slaDueAt ? issue.slaDueAt.toISOString() : null,
    slaStatus: issue.slaStatus,
    escalationLevel: issue.escalationLevel,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  };
}

export function mapEventDayLog(log: any) {
  return {
    id: log.id,
    eventId: log.eventId,
    actionType: log.actionType,
    actorName: log.actorName,
    actorRole: log.actorRole,
    message: log.message,
    affectedType: log.affectedType,
    affectedId: log.affectedId,
    metadata: log.metadata ?? {},
    createdAt: log.createdAt.toISOString(),
  };
}

export function mapCoordinatorAssignmentForEventDay(assignment: any) {
  return {
    id: assignment.id,
    eventId: assignment.eventId,
    coordinatorId: assignment.coordinatorId,
    coordinatorName: assignment.coordinatorName,
    role: assignment.role,
    status: assignment.status,
    attendanceStatus: assignment.attendanceStatus,
    attendanceMarkedAt: assignment.attendanceMarkedAt ? assignment.attendanceMarkedAt.toISOString() : null,
    attendanceNotes: assignment.attendanceNotes ?? '',
    replacementForAssignmentId: assignment.replacementForAssignmentId ?? null,
    replacementReason: assignment.replacementReason ?? '',
    createdAt: assignment.createdAt.toISOString(),
  };
}
```

If the current private mapper includes additional fields, keep those fields in this exported mapper and add them to the controller tests in Task 8.

- [x] **Step 2: Replace EventOpsService private mapper calls**

Import the exported mapper functions in `EventOpsService` so compatibility methods keep using the same response shape during the migration.

- [x] **Step 3: Run compatibility tests**

Run: `npm --workspace prism-api run test -- event-ops.service.test.ts`

Expected: PASS.

## Foundation Checkpoint

- [x] `npm --workspace prism-api run test -- controller-routes.test.ts event-ops.service.test.ts` passed after rerunning outside the sandbox for Vite `spawn EPERM`.
- [x] `npm --workspace prism-api run build` passed after rerunning outside the sandbox for generated metadata unlink permissions.
- [x] `npm run check:boundaries` passed after rerunning outside the sandbox for `spawnSync git EPERM`; rerun again after staging so new files are counted.

## Task 5 - Add Live-Ops Read And Command Services

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/services/event-live-ops-read.service.ts`
- Create: `apps/api/libs/modules/live-ops/src/services/event-live-ops-command.service.ts`

- [x] **Step 1: Create `EventLiveOpsReadService`**

Move the current `EventOpsService.getEventLiveOps`, `getEventDayStatusFeed`, and `getCoordinatorRoleView` behavior into a service that injects `PrismaService`, `EventAccessPolicyService`, `LiveOperationsService`, `CoordinatorsService`, `GuestWorkflowService`, and `FloorPlanWorkflowService`. The public signatures must be:

```ts
async getEventLiveOps(eventId: string, actorInput: LiveOpsActorDto = {}): Promise<unknown>
async getEventDayStatusFeed(eventId: string, actorInput: LiveOpsActorDto = {}): Promise<unknown>
async getCoordinatorRoleView(eventId: string, actorInput: LiveOpsActorDto = {}): Promise<unknown>
```

The implementation must preserve these behaviors from `EventOpsService`:

```ts
await this.eventAccessPolicyService.requireActorRole(
  actor,
  [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
  'live operations',
  eventId,
);
```

Coordinator actors must only see their assigned role tasks/issues and registration-role guest check-ins. PMCM/system actors keep the full live-ops payload.

- [x] **Step 2: Create `EventLiveOpsCommandService`**

Move command behavior currently exposed through these `EventOpsService` methods into the command service:

```ts
createEventDayTask(eventId: string, input: CreateEventDayTaskDto, actorInput?: LiveOpsActorDto)
updateEventDayTask(eventId: string, taskId: string, input: UpdateEventDayTaskDto, actorInput?: LiveOpsActorDto)
escalateEventDayTask(eventId: string, taskId: string, input: EscalateLiveOpsRecordDto, actorInput?: LiveOpsActorDto)
createUrgentIssue(eventId: string, input: CreateUrgentIssueDto, actorInput?: LiveOpsActorDto)
updateUrgentIssue(eventId: string, issueId: string, input: UpdateUrgentIssueDto, actorInput?: LiveOpsActorDto)
escalateUrgentIssue(eventId: string, issueId: string, input: EscalateLiveOpsRecordDto, actorInput?: LiveOpsActorDto)
updateCoordinatorAttendance(eventId: string, assignmentId: string, input: UpdateCoordinatorAttendanceDto, actorInput?: LiveOpsActorDto)
replaceCoordinatorAssignment(eventId: string, assignmentId: string, input: ReplaceCoordinatorAssignmentDto, actorInput?: LiveOpsActorDto)
verifySupplierEventStatus(eventId: string, requestId: string, input: VerifySupplierStatusDto, actorInput?: LiveOpsActorDto)
updateSupplierEventStatus(requestId: string, input: SupplierEventStatusDto, actorInput?: LiveOpsActorDto)
```

Use `EventAccessPolicyService.resolveActor` and the same PMCM/system/coordinator permission checks currently inside `EventOpsService.requireEventDayWriteActor`. Supplier self-report must require supplier role and must validate the request belongs to the resolved supplier from `SUPPLIER_DIRECTORY` before updating `opsSupplierQuoteRequest`.

- [x] **Step 3: Run focused service tests**

Run: `npm --workspace prism-api run test -- live-operations.service.test.ts event-ops.service.test.ts supplier-network-workflow.service.test.ts`

Expected: PASS.

Task 5 checkpoint:

- [x] `EventLiveOpsReadService` owns `getEventLiveOps`, `getEventDayStatusFeed`, and `getCoordinatorRoleView` read composition with coordinator role scoping preserved.
- [x] `EventLiveOpsCommandService` owns event-day task, urgent issue, coordinator attendance/replacement, supplier verification, and supplier self-report command entrypoints.
- [x] Supplier self-report keeps the current route payload shape (`photo` upload metadata) while avoiding a `SupplierOpsModule <-> LiveOpsModule` service cycle.
- [x] `npm --workspace prism-api run test -- live-operations.service.test.ts event-ops.service.test.ts supplier-network-workflow.service.test.ts` passed after rerunning outside the sandbox for Vite `spawn EPERM`.
- [x] `npm --workspace prism-api run build` passed after rerunning outside the sandbox for generated metadata unlink permissions.

## Task 6 - Register LiveOpsModule

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/live-ops.module.ts`
- Create: `apps/api/libs/modules/live-ops/src/index.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`

- [ ] **Step 1: Create module**

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FloorplanModule } from '@prism/modules/floorplan';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { StaffingOpsModule } from '@prism/modules/staffing-ops';
import { SupplierOpsModule, SUPPLIER_LIVE_OPERATIONS } from '@prism/modules/supplier-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { EventLiveOpsController } from './controllers/event-live-ops.controller';
import { CoordinatorLiveOpsController } from './controllers/coordinator-live-ops.controller';
import { SupplierLiveOpsController } from './controllers/supplier-live-ops.controller';
import { EventLiveOpsCommandService } from './services/event-live-ops-command.service';
import { EventLiveOpsReadService } from './services/event-live-ops-read.service';
import { LiveOperationsService } from './services/live-operations.service';

@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    EventCoreModule,
    TrustOpsModule,
    NotificationOpsModule,
    StaffingOpsModule,
    FloorplanModule,
    GuestOpsModule,
    SupplierOpsModule,
  ],
  controllers: [EventLiveOpsController, CoordinatorLiveOpsController, SupplierLiveOpsController],
  providers: [
    LiveOperationsService,
    EventLiveOpsReadService,
    EventLiveOpsCommandService,
    { provide: SUPPLIER_LIVE_OPERATIONS, useExisting: LiveOperationsService },
  ],
  exports: [LiveOperationsService, EventLiveOpsReadService, EventLiveOpsCommandService, SUPPLIER_LIVE_OPERATIONS],
})
export class LiveOpsModule {}
```

- [ ] **Step 2: Create barrel**

```ts
export * from './live-ops.module';
export * from './controllers/event-live-ops.controller';
export * from './controllers/coordinator-live-ops.controller';
export * from './controllers/supplier-live-ops.controller';
export * from './dto/live-ops.dto';
export * from './mappers/live-ops.mappers';
export * from './services/event-live-ops-command.service';
export * from './services/event-live-ops-read.service';
export * from './services/live-operations.service';
```

- [ ] **Step 3: Import `LiveOpsModule` in `EventOpsModule`**

Add `LiveOpsModule` to the `imports` array so the application registers the new route owners. Remove `LiveOperationsService` from `EVENT_OPS_PROVIDERS` only after all event-ops code imports it through the new module or compatibility re-export.

## Task 7 - Create Live-Ops Controllers And Remove Old Handlers

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/controllers/event-live-ops.controller.ts`
- Create: `apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.ts`
- Create: `apps/api/libs/modules/live-ops/src/controllers/supplier-live-ops.controller.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/events.controller.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/coordinator-workspace.controller.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/supplier-workspace.controller.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/index.ts`

- [ ] **Step 1: Create event live-ops controller**

The controller must keep the exact existing event route paths:

```ts
@Controller('events')
export class EventLiveOpsController {
  constructor(
    private readonly readService: EventLiveOpsReadService,
    private readonly commandService: EventLiveOpsCommandService,
  ) {}

  @Get(':eventId/live-ops')
  liveOps(@Param('eventId') eventId: string, @Query() actor: LiveOpsActorDto) {
    return this.readService.getEventLiveOps(eventId, actor);
  }

  @Get(':eventId/event-day/status-feed')
  statusFeed(@Param('eventId') eventId: string, @Query() actor: LiveOpsActorDto) {
    return this.readService.getEventDayStatusFeed(eventId, actor);
  }

  @Post(':eventId/event-day/tasks')
  @HttpCode(HttpStatus.CREATED)
  createEventDayTask(@Param('eventId') eventId: string, @Body() dto: CreateEventDayTaskDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.createEventDayTask(eventId, dto, actor);
  }

  @Patch(':eventId/event-day/tasks/:taskId')
  updateEventDayTask(@Param('eventId') eventId: string, @Param('taskId') taskId: string, @Body() dto: UpdateEventDayTaskDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.updateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/event-day/tasks/:taskId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateEventDayTask(@Param('eventId') eventId: string, @Param('taskId') taskId: string, @Body() dto: EscalateLiveOpsRecordDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.escalateEventDayTask(eventId, taskId, dto, actor);
  }

  @Post(':eventId/urgent-issues')
  @HttpCode(HttpStatus.CREATED)
  createUrgentIssue(@Param('eventId') eventId: string, @Body() dto: CreateUrgentIssueDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.createUrgentIssue(eventId, dto, actor);
  }

  @Patch(':eventId/urgent-issues/:issueId')
  updateUrgentIssue(@Param('eventId') eventId: string, @Param('issueId') issueId: string, @Body() dto: UpdateUrgentIssueDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.updateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Post(':eventId/urgent-issues/:issueId/escalate')
  @HttpCode(HttpStatus.OK)
  escalateUrgentIssue(@Param('eventId') eventId: string, @Param('issueId') issueId: string, @Body() dto: EscalateLiveOpsRecordDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.escalateUrgentIssue(eventId, issueId, dto, actor);
  }

  @Patch(':eventId/coordinators/:assignmentId/status')
  updateCoordinatorAttendance(@Param('eventId') eventId: string, @Param('assignmentId') assignmentId: string, @Body() dto: UpdateCoordinatorAttendanceDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.updateCoordinatorAttendance(eventId, assignmentId, dto, actor);
  }

  @Post(':eventId/coordinators/:assignmentId/replace')
  @HttpCode(HttpStatus.OK)
  replaceCoordinatorAssignment(@Param('eventId') eventId: string, @Param('assignmentId') assignmentId: string, @Body() dto: ReplaceCoordinatorAssignmentDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.replaceCoordinatorAssignment(eventId, assignmentId, dto, actor);
  }

  @Patch(':eventId/supplier-status/:requestId/verify')
  verifySupplierStatus(@Param('eventId') eventId: string, @Param('requestId') requestId: string, @Body() dto: VerifySupplierStatusDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.verifySupplierEventStatus(eventId, requestId, dto, actor);
  }
}
```

- [ ] **Step 2: Create coordinator and supplier controllers**

```ts
@Controller('coordinator')
export class CoordinatorLiveOpsController {
  constructor(private readonly readService: EventLiveOpsReadService) {}

  @Get('events/:eventId/role-view')
  roleView(@Param('eventId') eventId: string, @Query() actor: LiveOpsActorDto) {
    return this.readService.getCoordinatorRoleView(eventId, actor);
  }
}

@Controller('supplier')
export class SupplierLiveOpsController {
  constructor(private readonly commandService: EventLiveOpsCommandService) {}

  @Patch('quote-requests/:requestId/event-status')
  updateEventStatus(@Param('requestId') requestId: string, @Body() dto: SupplierEventStatusDto, @Query() actor: LiveOpsActorDto) {
    return this.commandService.updateSupplierEventStatus(requestId, dto, actor);
  }
}
```

- [ ] **Step 3: Remove old handlers**

Remove the moved handlers from `event-ops/src/controllers/events.controller.ts`, remove the role-view handler from `coordinator-workspace.controller.ts`, remove the supplier event-status handler from `supplier-workspace.controller.ts`, and update `EVENT_OPS_CONTROLLERS` to exclude empty compatibility controllers.

## Task 8 - Add Route Smoke Tests

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/controllers/event-live-ops.controller.test.ts`
- Create: `apps/api/libs/modules/live-ops/src/controllers/coordinator-live-ops.controller.test.ts`
- Create: `apps/api/libs/modules/live-ops/src/controllers/supplier-live-ops.controller.test.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/controller-routes.test.ts`

- [ ] **Step 1: Add route metadata/delegation tests**

Each test must assert the controller base path and that the controller calls the owning live-ops read/command service with unchanged route parameters and DTO objects. For example:

```ts
expect(controllerPath(EventLiveOpsController)).toBe('events');
await controller.createEventDayTask('evt_sample', { title: 'Open registration' }, { actorRole: 'pmcm-admin' });
expect(commandService.createEventDayTask).toHaveBeenCalledWith('evt_sample', { title: 'Open registration' }, { actorRole: 'pmcm-admin' });
```

- [ ] **Step 2: Update event-ops registry test**

After moving coordinator and supplier handlers, the expected registered bases should be:

```ts
expect(EVENT_OPS_CONTROLLERS.map(controllerPath).sort()).toEqual([
  'ai',
  'events',
  'sample',
]);
```

If `events.controller.ts` still owns defense-readiness and quote-request withdrawal, keep `events` in the list.

## Task 9 - Verification And Commit

**Files:**
- Modify docs listed in the evidence gate.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm --workspace prism-api run test -- event-live-ops.controller.test.ts coordinator-live-ops.controller.test.ts supplier-live-ops.controller.test.ts live-operations.service.test.ts event-ops.service.test.ts controller-routes.test.ts supplier-network-workflow.service.test.ts
```

Expected: all listed test files pass.

- [ ] **Step 2: Run build and boundary check**

Run:

```powershell
npm --workspace prism-api run build
npm run check:boundaries
```

Expected: API build succeeds and boundary check passes for all tracked app/package files.

- [ ] **Step 3: Commit**

```powershell
git add -- apps/api/libs/modules/live-ops apps/api/libs/modules/event-ops docs/prism-v4 docs/superpowers/plans
git commit -m "refactor(api): move live ops routes to live ops module"
```

## Self-Review

- Spec coverage: This plan covers the live/event-day route cluster, coordinator role-view, PMCM supplier verification, and supplier event-status. It intentionally does not cover PARE route ownership or quote-request withdrawal because those need PARE automation ownership rather than live-ops ownership.
- Red-flag scan: Every task names the route owner, file, command, and expected verification without banned marker terms or vague error-handling instructions.
- Type consistency: DTO names match current event-ops DTO names with a live-ops-owned actor DTO. Controller methods call `EventLiveOpsReadService` and `EventLiveOpsCommandService`, and those service names are registered by `LiveOpsModule`.
