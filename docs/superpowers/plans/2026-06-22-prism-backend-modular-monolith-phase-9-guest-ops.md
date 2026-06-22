# Guest Operations Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract guest portal and guest workflow behavior into a dedicated `guest-ops` API module while keeping public guest routes and event operations contracts stable.

**Architecture:** `guest-ops` owns guest access-code resolution, guest check-in writes, guest feedback writes, guest attendance reads, and guest payload mapping helpers through `GUEST_COMMANDS` and `GUEST_READER` ports. `event-ops` stays as the legacy route/facade surface for this phase but consumes `GuestWorkflowService` and guest reader methods from `@prism/modules/guest-ops` instead of directly owning guest workflow code.

**Tech Stack:** NestJS modules/providers, TypeScript path aliases, Prisma-backed service methods, Vitest unit coverage, existing Prism API module boundary checks.

---

## File Structure

- Create: `apps/api/libs/modules/guest-ops/src/guest-ops.module.ts`
  - Registers `GuestWorkflowService` and binds it to `GUEST_COMMANDS` and `GUEST_READER`.
- Create: `apps/api/libs/modules/guest-ops/src/index.ts`
  - Public module barrel for service, ports, tokens, and module.
- Create: `apps/api/libs/modules/guest-ops/src/ports/guest-commands.port.ts`
  - Defines guest write contract: check-in and feedback submission by access code.
- Create: `apps/api/libs/modules/guest-ops/src/ports/guest-reader.port.ts`
  - Defines guest read contract: event lookup by access code, attendance counts, event attendance lists, feedback lists, access-code generation, and guest payload mappers.
- Create: `apps/api/libs/modules/guest-ops/src/ports/guest-ops.tokens.ts`
  - Defines `GUEST_COMMANDS` and `GUEST_READER` provider tokens.
- Create: `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.ts`
  - Moves the existing guest workflow and adds reader-port methods used by event operations/read models.
- Create: `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.test.ts`
  - Focused tests for guest access, check-in, feedback, reader counts, and mapper output.
- Create: `apps/api/libs/modules/guest-ops/tsconfig.lib.json`
  - Library build config matching other extracted API modules.
- Modify: `apps/api/libs/modules/event-ops/src/services/guest-workflow.service.ts`
  - Replace legacy implementation with a re-export from `@prism/modules/guest-ops`.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
  - Import `GuestOpsModule`, import guest service from public module alias, and stop providing local guest workflow implementation.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
  - Import guest service and input types from `@prism/modules/guest-ops`.
  - Replace direct guest attendance counts/list reads with `GuestWorkflowService` reader methods.
  - Replace private guest mappers/access-code helper with delegated guest reader methods where guest-owned behavior is needed.
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.ts`
  - Inject `GuestReader` through `GUEST_READER`.
  - Use guest reader methods in PMCM event workspace and dashboards where guest read models are required.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`
  - Update guest service import and constructor wiring.
  - Add forbidden-role regression: guest cannot read PMCM planning/live payload.
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.test.ts`
  - Provide a guest reader mock when constructing the service.
  - Add regression that PMCM event workspace consumes guest reader when guest payloads are present.
- Modify: `apps/api/tsconfig.json`
  - Add `@prism/modules/guest-ops` and wildcard path aliases.
- Modify: `apps/api/vitest.config.ts`
  - Add `@prism/modules/guest-ops` test alias.
- Modify: `apps/api/nest-cli.json`
  - Add `guest-ops` library project.
- Modify: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`
  - Mark Phase 9 completed after verification.
- Modify: `docs/prism-v4/15-system-architecture.md`
  - Record `guest-ops` as the current owner for guest portal/write behavior.
- Modify: `docs/prism-v4/17-current-state-2026-06-20.md`
  - Record current guest module extraction evidence.

---

## Task 1: Baseline Guest Workflow Coverage

**Files:**
- Create: `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.test.ts`
- Read: `apps/api/libs/modules/event-ops/src/services/guest-workflow.service.ts`

- [ ] **Step 1: Write focused guest workflow tests**

Create a guest workflow test file with in-memory Prisma delegates covering:

```ts
it('resolves a guest event and returns attendance counts by access code', async () => {
  const { service } = createGuestWorkflowFixture();
  await expect(service.getEventByAccessCode('AYALA-TECH-MPLE')).resolves.toMatchObject({
    id: 'evt_sample',
    eventName: 'Ayala Tech Summit',
  });
  await expect(service.countCheckInsForEvent('evt_sample')).resolves.toBe(1);
});
```

```ts
it('requires privacy consent before guest check-in and feedback writes', async () => {
  const { service } = createGuestWorkflowFixture();
  await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', { guestName: 'Sofia Lim' })).rejects.toThrow(
    'Privacy consent is required before guest check-in',
  );
  await expect(service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5 })).rejects.toThrow(
    'Privacy consent is required before guest feedback submission',
  );
});
```

```ts
it('maps guest event, check-in, and feedback payloads without PMCM-only fields', async () => {
  const { service, state } = createGuestWorkflowFixture();
  expect(service.mapGuestEvent(state.events[0], 1)).toEqual(
    expect.objectContaining({
      id: 'evt_sample',
      eventName: 'Ayala Tech Summit',
      guestAccessCode: 'AYALA-TECH-MPLE',
      attendanceCount: 1,
    }),
  );
  expect(JSON.stringify(service.mapGuestEvent(state.events[0], 1))).not.toContain('privateNotes');
});
```

- [ ] **Step 2: Run baseline test and accept expected failure before the module exists**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/guest-ops/src/services/guest-workflow.service.test.ts
```

Expected before implementation: Vitest cannot find the test/service path or imported service.

---

## Task 2: Create Guest-Ops Module, Ports, and Service

**Files:**
- Create: `apps/api/libs/modules/guest-ops/src/guest-ops.module.ts`
- Create: `apps/api/libs/modules/guest-ops/src/index.ts`
- Create: `apps/api/libs/modules/guest-ops/src/ports/guest-commands.port.ts`
- Create: `apps/api/libs/modules/guest-ops/src/ports/guest-reader.port.ts`
- Create: `apps/api/libs/modules/guest-ops/src/ports/guest-ops.tokens.ts`
- Create: `apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.ts`
- Create: `apps/api/libs/modules/guest-ops/tsconfig.lib.json`
- Modify: `apps/api/libs/modules/event-ops/src/services/guest-workflow.service.ts`

- [ ] **Step 1: Add guest provider tokens**

```ts
export const GUEST_COMMANDS = Symbol('GUEST_COMMANDS');
export const GUEST_READER = Symbol('GUEST_READER');
```

- [ ] **Step 2: Add command and reader interfaces**

`GuestCommands` must expose:

```ts
checkInByAccessCode(accessCode: string, input: GuestCheckInInput): Promise<OpsGuestCheckIn>;
submitFeedbackByAccessCode(accessCode: string, input: GuestFeedbackInput): Promise<OpsGuestFeedback>;
```

`GuestReader` must expose:

```ts
getEventByAccessCode(accessCode: string): Promise<EventWithDrafts>;
countCheckInsForEvent(eventId: string): Promise<number>;
listCheckInsForEvent(eventId: string): Promise<OpsGuestCheckIn[]>;
listFeedbackForEvent(eventId: string): Promise<OpsGuestFeedback[]>;
guestAccessCode(event: Pick<OpsEvent, 'id' | 'eventName'>): string;
mapGuestEvent(event: EventWithDrafts, attendanceCount?: number): unknown;
mapGuestCheckIn(checkIn: OpsGuestCheckIn): unknown;
mapGuestFeedback(feedback: OpsGuestFeedback): unknown;
```

- [ ] **Step 3: Move and extend `GuestWorkflowService`**

Move the current implementation from:

```text
apps/api/libs/modules/event-ops/src/services/guest-workflow.service.ts
```

to:

```text
apps/api/libs/modules/guest-ops/src/services/guest-workflow.service.ts
```

Then add reader methods for attendance counts, event-scoped check-ins, event-scoped feedback, and guest payload mapping.

- [ ] **Step 4: Keep legacy imports stable**

Replace the old event-ops service file with:

```ts
export * from '@prism/modules/guest-ops';
```

- [ ] **Step 5: Register module bindings**

`GuestOpsModule` must import `DatabaseModule`, `EventCoreModule`, `TrustOpsModule`, and `FileOpsModule`; provide `GuestWorkflowService`; bind `GUEST_COMMANDS` and `GUEST_READER` to `GuestWorkflowService`; export the service and both tokens.

- [ ] **Step 6: Run focused guest workflow tests**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/guest-ops/src/services/guest-workflow.service.test.ts
```

Expected: PASS.

---

## Task 3: Wire Event-Ops Through Guest-Ops

**Files:**
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`

- [ ] **Step 1: Import `GuestOpsModule` in event-ops**

Add `GuestOpsModule` to `EventOpsModule.imports`.

- [ ] **Step 2: Import guest service and types from the public guest module**

Update event-ops imports to use:

```ts
import {
  GuestWorkflowService,
  type GuestCheckInInput,
  type GuestFeedbackInput,
} from '@prism/modules/guest-ops';
```

- [ ] **Step 3: Remove local guest provider ownership**

Remove `GuestWorkflowService` from `EVENT_OPS_PROVIDERS`; Nest should resolve it from `GuestOpsModule`.

- [ ] **Step 4: Replace direct guest queries in route facade methods**

Use guest reader methods in:

```ts
getGuestEventByAccessCode(accessCode: string)
checkInGuestByAccessCode(accessCode: string, input: GuestCheckInInput)
submitGuestFeedbackByAccessCode(accessCode: string, input: GuestFeedbackInput)
getEventLiveOps(eventId: string, actorInput: SampleActorInput = {})
getDefenseReadiness(eventId: string, actorInput: SampleActorInput = {})
getPrivacyInventory(input: PrivacyInventoryInput = {}, actorInput: SampleActorInput = input)
```

- [ ] **Step 5: Add forbidden-role regression for guest access**

Add an event-ops test asserting:

```ts
await expect((service as any).getEventLiveOps('evt_sample', { actorRole: 'guest' })).rejects.toBeInstanceOf(ForbiddenException);
```

- [ ] **Step 6: Run event-ops guest tests**

Run:

```bash
npm --workspace prism-api run test -- guest
```

Expected: guest-related test files pass.

---

## Task 4: Make Read Models Consume Guest Reader Ports

**Files:**
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.ts`
- Modify: `apps/api/libs/modules/event-ops/src/services/event-read-models.service.test.ts`

- [ ] **Step 1: Inject the `GUEST_READER` port**

Update constructor:

```ts
constructor(
  private readonly prisma: PrismaService,
  private readonly policy: EventAccessPolicyService,
  private readonly suppliersService: SuppliersService,
  @Inject(GUEST_READER) private readonly guestReader: GuestReader,
) {}
```

- [ ] **Step 2: Add guest data to PMCM event workspace**

Fetch guest check-ins and feedback through the guest reader when building a PMCM event workspace. Return mapped guest arrays and attendance count through the existing PMCM-only workspace contract.

- [ ] **Step 3: Keep guest payloads role-scoped**

Do not add guest arrays to client or supplier read models in this phase. Guest public routes stay under `OpsGuestController` and the event facade delegates to `GuestWorkflowService`.

- [ ] **Step 4: Update tests with a guest reader mock**

Each `EventReadModelsService` test fixture must pass a guest reader mock with these methods:

```ts
listCheckInsForEvent: vi.fn(async () => []),
listFeedbackForEvent: vi.fn(async () => []),
mapGuestCheckIn: vi.fn((checkIn) => checkIn),
mapGuestFeedback: vi.fn((feedback) => feedback),
```

- [ ] **Step 5: Add port-consumption assertion**

In the PMCM event workspace test, assert:

```ts
expect(guestReader.listCheckInsForEvent).toHaveBeenCalledWith('evt_visible');
expect(guestReader.listFeedbackForEvent).toHaveBeenCalledWith('evt_visible');
```

- [ ] **Step 6: Run read-model tests**

Run:

```bash
npm --workspace prism-api run test -- services/event-read-models.service.test.ts
```

Expected: PASS.

---

## Task 5: Register Build and Test Aliases

**Files:**
- Modify: `apps/api/tsconfig.json`
- Modify: `apps/api/vitest.config.ts`
- Modify: `apps/api/nest-cli.json`

- [ ] **Step 1: Add TypeScript path aliases**

Add:

```json
"@prism/modules/guest-ops": ["libs/modules/guest-ops/src/index"],
"@prism/modules/guest-ops/*": ["libs/modules/guest-ops/src/*"]
```

- [ ] **Step 2: Add Vitest alias**

Add:

```ts
'@prism/modules/guest-ops': resolve(__dirname, './libs/modules/guest-ops/src/index.ts'),
```

- [ ] **Step 3: Add Nest library project**

Add a `guest-ops` project entry with root `libs/modules/guest-ops`, entry file `index`, source root `libs/modules/guest-ops/src`, and `tsConfigPath` `libs/modules/guest-ops/tsconfig.lib.json`.

- [ ] **Step 4: Run build**

Run:

```bash
npm --workspace prism-api run build
```

Expected: PASS.

---

## Task 6: Documentation and Completion Checks

**Files:**
- Modify: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`
- Modify: `docs/prism-v4/15-system-architecture.md`
- Modify: `docs/prism-v4/17-current-state-2026-06-20.md`

- [ ] **Step 1: Mark Phase 9 complete in the master plan**

Check these Phase 9 boxes only after tests pass:

```text
Create guest-ops module.
Move GuestWorkflowService.
Add guest command and reader ports.
Keep guest portal route contracts stable.
Add guest event access policy checks.
Update read models to consume guest reader ports.
Tests.
Exit checks.
```

- [ ] **Step 2: Update architecture and current-state docs**

Record that guest access-code resolution, check-in, feedback, attendance reads, and guest payload mapping are now owned by `guest-ops`, while `event-ops` keeps legacy public guest route compatibility.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm --workspace prism-api run test -- libs/modules/guest-ops/src/services/guest-workflow.service.test.ts
npm --workspace prism-api run test -- guest
npm --workspace prism-api run test -- event-ops.service.test.ts
npm --workspace prism-api run test -- services/event-read-models.service.test.ts
npm --workspace prism-api run test:event-ops
npm --workspace prism-api run build
npm run check:boundaries
rg -n "from './services/guest-workflow.service'|from '../services/guest-workflow.service'" apps/api/libs/modules
git diff --check
```

Expected: all tests/build/checks pass; the private import scan returns no matches or only the legacy re-export if intentionally retained.

- [ ] **Step 4: Commit implementation**

Commit message:

```bash
git add apps/api docs
git commit -m "refactor(api): extract guest operations module"
```

---

## Self-Review

- Spec coverage: This plan covers all Phase 9 bullets from the master plan: module creation, service move, command/reader ports, route stability, access policy regression, read-model guest reader consumption, tests, docs, and commit checkpoint.
- Placeholder scan: No `TBD`, `TODO`, or vague "add tests" placeholders remain; each task names files, methods, commands, and expected outcomes.
- Type consistency: `GuestCheckInInput`, `GuestFeedbackInput`, `GuestCommands`, `GuestReader`, `GUEST_COMMANDS`, and `GUEST_READER` names are used consistently across task steps.
