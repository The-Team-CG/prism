# Staffing Operations Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract internal coordinator staffing directory and assignment workflow into a dedicated `staffing-ops` API module while keeping event-day live operations and existing route contracts stable.

**Architecture:** `staffing-ops` owns coordinator directory reads, coordinator assignment commands, assignment acknowledgement, coordinator assignment mapping, and staffing reader ports. `event-ops` remains the compatibility facade for existing controller methods. `LiveOperationsService` keeps event-day task, urgent issue, coordinator attendance, and replacement behavior in this phase because those workflows produce event-day logs and live operational side effects rather than pure staffing assignment ownership.

**Tech Stack:** NestJS modules/providers, TypeScript path aliases, Prisma-backed service methods, public provider tokens, Vitest unit and facade tests, Prism boundary checker.

---

## File Structure

- Create: `apps/api/libs/modules/staffing-ops/src/staffing-ops.module.ts`
  - Registers `CoordinatorsService` and binds it to `STAFFING_COMMANDS` and `STAFFING_READER`.
- Create: `apps/api/libs/modules/staffing-ops/src/index.ts`
  - Public barrel for module, service, ports, and tokens.
- Create: `apps/api/libs/modules/staffing-ops/src/ports/staffing-commands.port.ts`
  - Defines assignment write contract for coordinator assignment and acknowledgement.
- Create: `apps/api/libs/modules/staffing-ops/src/ports/staffing-reader.port.ts`
  - Defines coordinator directory/read contract for PMCM/coordinator-scoped staffing reads.
- Create: `apps/api/libs/modules/staffing-ops/src/ports/staffing-ops.tokens.ts`
  - Defines `STAFFING_COMMANDS` and `STAFFING_READER`.
- Create: `apps/api/libs/modules/staffing-ops/src/services/coordinators.service.ts`
  - Moves the existing service and adds reader methods needed by coordinator workspace compatibility methods.
- Create: `apps/api/libs/modules/staffing-ops/src/services/coordinators.service.test.ts`
  - Focused command/read tests for conflict-gated assignment, acknowledgement, directory read, and coordinator assignment reads.
- Create: `apps/api/libs/modules/staffing-ops/tsconfig.lib.json`
  - Library build config matching existing capability modules.
- Modify: `apps/api/libs/modules/event-ops/src/services/coordinators.service.ts`
  - Replace implementation with `export * from '@prism/modules/staffing-ops';`.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
  - Import `StaffingOpsModule`; remove local `CoordinatorsService` provider.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
  - Import coordinator service and assignment input type from `@prism/modules/staffing-ops`.
  - Delegate coordinator directory, assignment, acknowledgement, coordinator-profile resolution, and coordinator assignment reads to staffing reader methods.
  - Keep live-operations attendance/replacement/event-day behavior in `LiveOperationsService`.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`
  - Import `CoordinatorsService` from `@prism/modules/staffing-ops`.
  - Add forbidden-role test that client, supplier, and guest actors cannot access internal staffing/coordinator directory payloads.
- Modify: `apps/api/tsconfig.json`
  - Add `@prism/modules/staffing-ops` path aliases.
- Modify: `apps/api/vitest.config.ts`
  - Add `@prism/modules/staffing-ops` alias.
- Modify: `apps/api/nest-cli.json`
  - Add the `staffing-ops` library project.
- Modify: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`
  - Mark Phase 10 complete after verification.
- Modify: `docs/prism-v4/15-system-architecture.md`
  - Record `staffing-ops` as active for coordinator directory/assignment ownership.
- Modify: `docs/prism-v4/17-current-state-2026-06-20.md`
  - Append a Phase 10 staffing post-snapshot note.

---

## Task 1: Baseline Staffing Coverage

**Files:**
- Create: `apps/api/libs/modules/staffing-ops/src/services/coordinators.service.test.ts`
- Read: `apps/api/libs/modules/event-ops/src/services/coordinators.service.test.ts`

- [ ] **Step 1: Move the focused coordinator service test into the new module path**

Copy the existing test shape and update imports so it targets:

```ts
import { CoordinatorsService } from './coordinators.service';
```

The test must keep these assertions:

```ts
await expect(
  service.assignCoordinator(event.id, { coordinatorId: coordinator.id, role: 'Floor Director' }),
).rejects.toBeInstanceOf(BadRequestException);

const assignment = await service.assignCoordinator(event.id, {
  coordinatorId: coordinator.id,
  role: 'Floor Director',
  overrideConflict: true,
});

expect(assignment.doubleBookingWarning).toBe(true);
expect(assignment.conflictEventName).toBe('Other Event');
expect(fake.notifications).toHaveLength(2);
expect(fake.audits).toHaveLength(1);
expect(fake.transactionCalls).toEqual(['same_tx']);
```

- [ ] **Step 2: Add internal staffing read coverage**

Add a read test:

```ts
it('reads active coordinator directory and coordinator assignments for workspace payloads', async () => {
  const fake = createPrisma();
  const service = createService(fake.prisma as any);
  await service.assignCoordinator(event.id, {
    coordinatorId: coordinator.id,
    role: 'Floor Director',
    overrideConflict: true,
  });

  await expect(service.listCoordinators()).resolves.toEqual([
    expect.objectContaining({ id: 'coord_marco', name: 'Marco Santos' }),
  ]);
  await expect(service.listAssignmentsForCoordinator(coordinator.id, coordinator.name)).resolves.toEqual([
    expect.objectContaining({ coordinatorId: 'coord_marco', role: 'Floor Director' }),
  ]);
});
```

- [ ] **Step 3: Run baseline test and accept expected failure before the module exists**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/staffing-ops/src/services/coordinators.service.test.ts
```

Expected before implementation: FAIL because `staffing-ops` paths do not exist.

---

## Task 2: Create Staffing-Ops Module, Ports, and Service

**Files:**
- Create: `apps/api/libs/modules/staffing-ops/src/staffing-ops.module.ts`
- Create: `apps/api/libs/modules/staffing-ops/src/index.ts`
- Create: `apps/api/libs/modules/staffing-ops/src/ports/staffing-commands.port.ts`
- Create: `apps/api/libs/modules/staffing-ops/src/ports/staffing-reader.port.ts`
- Create: `apps/api/libs/modules/staffing-ops/src/ports/staffing-ops.tokens.ts`
- Create: `apps/api/libs/modules/staffing-ops/src/services/coordinators.service.ts`
- Create: `apps/api/libs/modules/staffing-ops/tsconfig.lib.json`
- Modify: `apps/api/libs/modules/event-ops/src/services/coordinators.service.ts`

- [ ] **Step 1: Add staffing tokens**

```ts
export const STAFFING_COMMANDS = Symbol('STAFFING_COMMANDS');
export const STAFFING_READER = Symbol('STAFFING_READER');
```

- [ ] **Step 2: Add command interface**

```ts
import type { CreateCoordinatorAssignmentInput } from '../services/coordinators.service';

export interface StaffingCommands {
  assignCoordinator(eventId: string, input: CreateCoordinatorAssignmentInput): Promise<unknown>;
  acknowledgeCoordinator(eventId: string, assignmentId: string): Promise<unknown>;
}
```

- [ ] **Step 3: Add reader interface**

```ts
import type { OpsCoordinator, OpsCoordinatorAssignment } from '@prisma/client';

export interface StaffingReader {
  listCoordinators(): Promise<unknown[]>;
  listAssignmentsForCoordinator(coordinatorId?: string | null, coordinatorName?: string | null): Promise<OpsCoordinatorAssignment[]>;
  listAssignmentsForEvent(eventId: string): Promise<OpsCoordinatorAssignment[]>;
  resolveCoordinatorForActor(actor: { coordinatorId?: string; email?: string; name?: string }): Promise<OpsCoordinator>;
  findAssignmentForEventActor(eventId: string, actor: { coordinatorId?: string; email?: string; name?: string }): Promise<OpsCoordinatorAssignment | null>;
  mapCoordinator(coordinator: OpsCoordinator): unknown;
  mapCoordinatorAssignment(assignment: OpsCoordinatorAssignment): unknown;
}
```

- [ ] **Step 4: Move and extend `CoordinatorsService`**

Move the current implementation from:

```text
apps/api/libs/modules/event-ops/src/services/coordinators.service.ts
```

to:

```text
apps/api/libs/modules/staffing-ops/src/services/coordinators.service.ts
```

Update imports to public modules:

```ts
import { AuditActionType, AuditCategory, CoordinatorAssignmentStatus, WorkflowCommandService } from '@prism/modules/event-core';
import type { AuditWriter } from '@prism/modules/trust-ops';
import { AUDIT_WRITER } from '@prism/modules/trust-ops';
import type { NotificationOutboxWriter } from '@prism/modules/notification-ops';
import { NOTIFICATION_OUTBOX_WRITER } from '@prism/modules/notification-ops';
import { WORKFLOW_COMMAND_LOG } from '@prism/modules/event-core';
```

Add reader methods:

```ts
async listAssignmentsForCoordinator(coordinatorId?: string | null, coordinatorName?: string | null) {
  const byId = coordinatorId
    ? await this.prisma.opsCoordinatorAssignment.findMany({ where: { coordinatorId }, orderBy: { createdAt: 'desc' } })
    : [];
  const byName = coordinatorName
    ? await this.prisma.opsCoordinatorAssignment.findMany({ where: { coordinatorName }, orderBy: { createdAt: 'desc' } })
    : [];
  return [...byId, ...byName].filter((assignment, index, all) => all.findIndex((item) => item.id === assignment.id) === index);
}

listAssignmentsForEvent(eventId: string) {
  return this.prisma.opsCoordinatorAssignment.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } });
}
```

- [ ] **Step 5: Keep legacy import path stable**

Replace the old event-ops service file with:

```ts
export * from '@prism/modules/staffing-ops';
```

- [ ] **Step 6: Register `StaffingOpsModule`**

The module must import `DatabaseModule`, `EventCoreModule`, `TrustOpsModule`, and `NotificationOpsModule`; provide `CoordinatorsService`; bind `STAFFING_COMMANDS` and `STAFFING_READER`; export service and tokens.

- [ ] **Step 7: Run focused staffing service tests**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/staffing-ops/src/services/coordinators.service.test.ts
```

Expected: PASS.

---

## Task 3: Wire Event-Ops Through Staffing-Ops

**Files:**
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`

- [ ] **Step 1: Import `StaffingOpsModule` in event-ops**

Add `StaffingOpsModule` to `EventOpsModule.imports`, and import `CoordinatorsService` from `@prism/modules/staffing-ops` in `event-ops.service.ts` and tests.

- [ ] **Step 2: Remove local staffing provider ownership**

Remove local `CoordinatorsService` from `EVENT_OPS_PROVIDERS`; Nest should resolve the exported provider from `StaffingOpsModule`.

- [ ] **Step 3: Delegate coordinator workspace reads to staffing service methods**

Update:

```ts
listCoordinatorWorkspace(actorInput: SampleActorInput = {})
resolveCoordinatorForActor(actor: ResolvedSampleActor)
requireCoordinatorAssignmentForEvent(eventId: string, actor: ResolvedSampleActor)
```

so assignment reads and coordinator resolution use `CoordinatorsService` reader methods rather than direct Prisma reads.

- [ ] **Step 4: Keep event-day operations in live ops**

Do not move these methods in Phase 10:

```ts
createEventDayTask
updateEventDayTask
createUrgentIssue
updateUrgentIssue
escalateEventDayTask
escalateUrgentIssue
replaceCoordinatorAssignment
updateCoordinatorAttendance
recordEventDayLog
buildStatusFeed
```

They remain event-day operations until a later live-ops child plan creates a proper owner.

- [ ] **Step 5: Add forbidden-role staffing regression**

Add event-ops test assertions:

```ts
await expect((service as any).listCoordinators({ actorRole: 'client', clientName: 'Ana Reyes' })).rejects.toBeInstanceOf(ForbiddenException);
await expect((service as any).listCoordinators({ actorRole: 'supplier', supplierId: 'sup_sonicline' })).rejects.toBeInstanceOf(ForbiddenException);
await expect((service as any).listCoordinators({ actorRole: 'guest', actorName: 'Guest User' })).rejects.toBeInstanceOf(ForbiddenException);
```

- [ ] **Step 6: Run coordinator/event-ops tests**

Run:

```bash
npm --workspace prism-api run test -- coordinator
npm --workspace prism-api run test -- event-ops.service.test.ts
```

Expected: PASS.

---

## Task 4: Register Build and Test Aliases

**Files:**
- Modify: `apps/api/tsconfig.json`
- Modify: `apps/api/vitest.config.ts`
- Modify: `apps/api/nest-cli.json`

- [ ] **Step 1: Add TypeScript aliases**

```json
"@prism/modules/staffing-ops": ["libs/modules/staffing-ops/src/index"],
"@prism/modules/staffing-ops/*": ["libs/modules/staffing-ops/src/*"]
```

- [ ] **Step 2: Add Vitest alias**

```ts
'@prism/modules/staffing-ops': resolve(__dirname, './libs/modules/staffing-ops/src/index.ts'),
```

- [ ] **Step 3: Add Nest project**

Add a `staffing-ops` library project pointing to `libs/modules/staffing-ops/tsconfig.lib.json`.

- [ ] **Step 4: Run build**

Run:

```bash
npm --workspace prism-api run build
```

Expected: PASS.

---

## Task 5: Documentation and Completion Checks

**Files:**
- Modify: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`
- Modify: `docs/prism-v4/15-system-architecture.md`
- Modify: `docs/prism-v4/17-current-state-2026-06-20.md`

- [ ] **Step 1: Mark Phase 10 complete in the master plan**

Only check Phase 10 boxes after implementation and verification pass.

- [ ] **Step 2: Update architecture/current-state docs**

Record that `staffing-ops` owns coordinator directory reads, assignment commands, acknowledgement, and assignment reader ports. Record that event-day attendance and replacement remain in live operations pending a later live-ops owner extraction.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/staffing-ops/src/services/coordinators.service.test.ts
npm --workspace prism-api run test -- coordinator
npm --workspace prism-api run test -- event-ops.service.test.ts
npm --workspace prism-api run test:event-ops
npm --workspace prism-api run build
npm run check:boundaries
rg -n "from './services/coordinators.service'|from '../services/coordinators.service'" apps/api/libs/modules
git diff --check
```

Expected: targeted tests, full event-ops tests, build, boundary check, and diff check pass. Private coordinator service imports may appear inside `staffing-ops` itself, but not across module boundaries.

- [ ] **Step 4: Commit implementation**

Commit message:

```bash
git add apps/api docs
git commit -m "refactor(api): extract staffing operations module"
```

---

## Self-Review

- Spec coverage: Covers the Phase 10 bullets for `staffing-ops` module creation, coordinator staffing movement, command/reader ports, scoped event-day boundary decision, PMCM/coordinator role tests, internal staffing read tests, forbidden-role coverage, docs, and checkpoint commit.
- Boundary clarity: This plan intentionally does not move event-day attendance/replacement out of `LiveOperationsService`; those methods are operational live-event behavior, not pure staffing assignment ownership.
- Placeholder scan: No `TBD`, `TODO`, or generic "add tests" placeholders remain; each task names concrete files, methods, commands, and expected results.
- Type consistency: `CoordinatorsService`, `CreateCoordinatorAssignmentInput`, `STAFFING_COMMANDS`, `STAFFING_READER`, `StaffingCommands`, and `StaffingReader` are used consistently.
