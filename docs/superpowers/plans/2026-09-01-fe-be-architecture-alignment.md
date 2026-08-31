# FE/BE Architecture Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/client`, `apps/event`, `apps/guest`, `apps/supplier` into
alignment with `next-feature-architecture`, and `apps/api` into alignment with
`backend-architecture`, fixing every finding from the 2026-09-01 alignment
review and priority/risk matrix, in dependency order, with URL and behavior
preservation throughout.

**Architecture:** No new architectural pattern is introduced. Every task
applies patterns the codebase (or the sibling `alphaci-enterprise-fe`/`-be`
repos) already uses correctly elsewhere: Next.js route groups, one-line
barrel `page.tsx` re-exports, scoped layouts, a thin pure `domain/` layer for
state-machine invariants, and Nest module consolidation along real ownership
lines. Each task is a narrow, behavior-preserving refactor — no rewrites.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript across 4
portals; NestJS 11 + Prisma 7 + Postgres + Zod for `apps/api`; npm workspaces
/ Turborepo monorepo; Vitest for all tests.

## Global Constraints

- **Never change a public URL.** Every existing route must resolve to the
  same content after any FE task in this plan (`AGENTS.md`: preserve URLs
  during structural frontend work).
- **Feature branch + PR; conventional commits** (`feat:`, `fix:`, `refactor:`)
  per `AGENTS.md`. Work happens on `codex/architecture-alignment-fe-be`.
- **Shared contracts (Zod schema + `z.infer`) live only in `@prism/types`.**
  No task in this plan adds a parallel hand-written type.
- **No cross-app imports; no deep cross-feature imports.** Every task must
  pass `node <skill>/scripts/check-boundaries.mjs` for its touched paths
  before being marked done.
- **Typecheck + tests for touched packages** before any commit in this plan.
  Rebuild `@prism/types` (`npm --workspace @prism/types run build`) after any
  change to that package before touching `apps/api` or any portal.
- **No `db:reset`, no destructive migrations** in this plan — every backend
  task is a code-only refactor (module reorganization, no schema change)
  except where explicitly noted.
- **One vertical capability moves at a time** (`extract-module.md`: don't
  extract and rewrite simultaneously). Every module-shape change in this plan
  preserves existing behavior; do not "improve" logic while moving it.
- **Do one route/section/module at a time for the large FE tasks** (F4c, F3,
  F6) — verify after each, never batch multiple sections in one commit.

---

## Task sequencing (from the priority/risk matrix)

```text
 1. Task 1  — B4a: fix file-ops controller's direct Prisma access      (P0)
 2. Task 2  — B4b: fix floorplan controller's direct Prisma access     (P0)
 3. Task 3  — FE-cleanup: delete dead apps/client/src/app/App.tsx      (P0)
 4. Task 4  — F4a: route groups in apps/client                        (P0)
 5. Task 5  — F4a: route groups in apps/event                         (P0)
 6. Task 6  — F4a: route groups in apps/guest                         (P0)
 7. Task 7  — F4a: route groups in apps/supplier                      (P0)
 8. Task 8  — F1: consolidate event-dashboard/workspace/command-inbox
               selectors into one canonical home                       (P1)
 9. Task 9  — B1: live-ops domain layer                                (P1)
10. Task 10 — Merge: fold events+plans+templates+publishing into
               floorplan-authoring                                     (P1)
11. Task 11 — F6: scope the event dashboard layout per section         (P1)
12. Task 12 — F3: split the 941-line mega view-model                   (P2)
13. Task 13 — F4b: collapse literal filter folders into [param]        (P2)
14. Task 14 — F4c: real per-section pages in the event app (one section
               worked in full; remaining sections listed explicitly)   (P2)
15. Task 15 — B1b: supplier-ops domain layer                           (P2)
16. Task 16 — B2: document owned/read-only Prisma tables per module    (P2)
```

Deferred / no task in this plan (per the matrix's P3 — informational only,
no action needed): F2 (`event-ops` fan-in), B3 (`sample-compatibility` fan-in),
platform relabel of `health`/`event-session`.

---

### Task 1: Fix `file-ops` controller's direct Prisma access (B4a)

**Files:**
- Modify: `apps/api/libs/modules/file-ops/src/services/file-requirements-matrix.service.ts`
- Modify: `apps/api/libs/modules/file-ops/src/controllers/event-file-requirements.controller.ts`
- Test: `apps/api/libs/modules/file-ops/src/controllers/event-file-requirements.controller.test.ts`

**Interfaces:**
- Consumes: existing `FileRequirementsMatrixService.buildForEvent(eventId: string): Promise<FileRequirementsMatrix>`
- Produces: new `FileRequirementsMatrixService.requireEvent(eventId: string): Promise<OpsEvent>` (throws `NotFoundException` on miss, same message the controller throws today: `'Event not found'`) — later tasks/services in this module may reuse it.

- [ ] **Step 1: Write the failing test**

Add this test to the existing describe block in
`apps/api/libs/modules/file-ops/src/controllers/event-file-requirements.controller.test.ts`
(insert after the `'does not build the matrix when the event is missing or access is denied'` test):

```ts
  it('does not inject PrismaService into the controller', () => {
    const { controller } = createController();
    expect((controller as unknown as Record<string, unknown>).prisma).toBeUndefined();
  });
```

Also change `createController()`'s constructor call — it currently passes
three args `(fileRequirementsMatrixService, eventAccessPolicyService, prisma)`.
Change it to pass only two:

```ts
  const controller = new OpsEventFileRequirementsController(
    fileRequirementsMatrixService as any,
    eventAccessPolicyService as any,
  );
  return { controller, fileRequirementsMatrixService, eventAccessPolicyService };
```

And remove `prisma` from every destructured `createController()` call in the
file (the four `it(...)` blocks that currently destructure `prisma`) along
with any `expect(prisma.opsEvent.findUnique)...` assertions — those now move
to the service test in Step 1 below is unnecessary; instead add a matching
expectation on the mocked service:

Replace `expect(prisma.opsEvent.findUnique).toHaveBeenCalledWith({ where: { id: 'evt_file' } });`
with `expect(fileRequirementsMatrixService.buildForEvent).toHaveBeenCalledWith('evt_file');`
(this assertion already exists immediately below it — just delete the
redundant prisma-specific line).

For the `'does not build the matrix when the event is missing or access is
denied'` test, replace the `prisma.opsEvent.findUnique.mockResolvedValueOnce(null as any)`
setup with a mock on the service instead:

```ts
  it('does not build the matrix when the event is missing or access is denied', async () => {
    const { controller, fileRequirementsMatrixService, eventAccessPolicyService } = createController();
    eventAccessPolicyService.requireCanReadEvent.mockRejectedValueOnce(
      new NotFoundException('Event not found'),
    );

    await expect(controller.fileRequirements('evt_missing', { actorRole: OpsUserRole.PmcmAdmin })).rejects.toBeInstanceOf(NotFoundException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();

    eventAccessPolicyService.requireCanReadEvent.mockRejectedValueOnce(
      new ForbiddenException('guest cannot access file requirements matrix'),
    );

    await expect(controller.fileRequirements('evt_file', { actorRole: OpsUserRole.Guest })).rejects.toBeInstanceOf(ForbiddenException);
    expect(fileRequirementsMatrixService.buildForEvent).not.toHaveBeenCalled();
  });
```

Also update `createController()`'s `eventAccessPolicyService` mock so
`requireCanReadEvent` is the thing that can reject (it already is — no
change needed there), and remove the now-unused `prisma` mock object
entirely from `createController()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace prism-api run test -- controllers/event-file-requirements.controller.test.ts`
Expected: FAIL — `OpsEventFileRequirementsController` constructor still
requires 3 args (TypeScript error) and `prisma` mock no longer exists where
old assertions still reference it.

- [ ] **Step 3: Move the event lookup into the service**

Modify `apps/api/libs/modules/file-ops/src/services/file-requirements-matrix.service.ts`:
add `NotFoundException` to the existing `@nestjs/common` import, and add a
new method right after the constructor:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
```

```ts
  async requireEvent(eventId: string): Promise<OpsEvent> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
```

- [ ] **Step 4: Rewrite the controller to use the service, drop `PrismaService`**

Replace the full contents of
`apps/api/libs/modules/file-ops/src/controllers/event-file-requirements.controller.ts`
with:

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { FileRequirementsActorDto } from '../dto/file-requirements.dto';
import { FileRequirementsMatrixService } from '../services/file-requirements-matrix.service';

@Controller('events')
export class OpsEventFileRequirementsController {
  constructor(
    private readonly fileRequirementsMatrixService: FileRequirementsMatrixService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/file-requirements')
  async fileRequirements(@Param('eventId') eventId: string, @Query() actorInput: FileRequirementsActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const event = await this.fileRequirementsMatrixService.requireEvent(eventId);

    await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'file requirements matrix');

    const matrix = await this.fileRequirementsMatrixService.buildForEvent(eventId);
    return {
      ...matrix,
      items: matrix.items.filter((item) => item.visibleToRoles.includes(actor.role)),
    };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --workspace prism-api run test -- controllers/event-file-requirements.controller.test.ts`
Expected: PASS (all tests, including the new constructor-shape test)

Run: `npm --workspace prism-api run test -- services/file-requirements-matrix.service.test.ts`
Expected: PASS (unchanged — no existing test covers `requireEvent`; that's
fine, the controller test exercises it end-to-end)

- [ ] **Step 6: Typecheck and boundary check**

Run: `npm run typecheck` (workspace root, or `npm --workspace prism-api run typecheck`)
Expected: no errors

Run: `node ~/.agents/skills/backend-architecture/scripts/check-boundaries.mjs apps/api --paths libs/modules/file-ops --fail-on error`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/libs/modules/file-ops
git commit -m "refactor(file-ops): move opsEvent lookup out of controller into service"
```

---

### Task 2: Fix `floorplan` controller's direct Prisma access (B4b)

**Files:**
- Modify: `apps/api/libs/modules/floorplan/src/services/floor-plan-workflow.service.ts`
- Modify: `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.ts`
- Test: `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts`

**Interfaces:**
- Consumes: existing `FloorPlanWorkflowService` methods (`createFloorPlanDraft`, `createFloorPlanPreference`, `submitFloorPlanDraft`, `approveFloorPlanDraft`, `getFloorPlanSnapshot`) — unchanged signatures.
- Produces: new `FloorPlanWorkflowService.requireEvent(eventId: string): Promise<OpsEvent>` (throws `NotFoundException` — matches the controller's current `findUniqueOrThrow` behavior exactly, since Prisma's `findUniqueOrThrow` also throws when missing).

- [ ] **Step 1: Write the failing test**

In `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.test.ts`,
change `createController()`'s constructor call from 3 args to 2:

```ts
  const controller = new OpsEventFloorplansController(
    floorPlanWorkflowService as any,
    eventAccessPolicyService as any,
  );
  return { controller, floorPlanWorkflowService, eventAccessPolicyService };
```

Remove the `prisma` mock object from `createController()` entirely, and
add `requireEvent: vi.fn(async () => ({ id: 'evt_sample', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' }))`
to the `floorPlanWorkflowService` mock object.

In the second `it(...)` block ("serves client preferences and snapshots
through floorplan ownership"), the destructure currently reads
`const { controller, floorPlanWorkflowService, eventAccessPolicyService, prisma } = createController();`
— change to drop `prisma`, and replace
`expect(prisma.opsEvent.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'evt_sample' } });`
with:

```ts
    expect(floorPlanWorkflowService.requireEvent).toHaveBeenCalledWith('evt_sample');
```

Also add a new test at the end of the describe block:

```ts
  it('does not inject PrismaService into the controller', () => {
    const { controller } = createController();
    expect((controller as unknown as Record<string, unknown>).prisma).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace prism-api run test -- controllers/event-floorplans.controller.test.ts`
Expected: FAIL — constructor arity mismatch / `requireEvent` not called

- [ ] **Step 3: Move the event lookup into the service**

Modify `apps/api/libs/modules/floorplan/src/services/floor-plan-workflow.service.ts`:
add `NotFoundException` to the existing `@nestjs/common` import (it is
already imported there — reuse it), and add a new method:

```ts
  async requireEvent(eventId: string): Promise<OpsEvent> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
```

(Uses `findUnique` + explicit throw rather than `findUniqueOrThrow` so the
error message matches the file-ops service from Task 1 exactly — Prisma's
own `findUniqueOrThrow` throws a `PrismaClientKnownRequestError`, not a Nest
`NotFoundException`, so this preserves the controller's actual current
behavior more faithfully than the original code did.)

- [ ] **Step 4: Rewrite the controller to use the service, drop `PrismaService`**

In `apps/api/libs/modules/floorplan/src/controllers/event-floorplans.controller.ts`:

1. Remove `import { PrismaService } from '@prism/database';`
2. Remove `private readonly prisma: PrismaService,` from the constructor
   parameter list
3. Replace the private `requireEvent` method at the bottom of the class:

```ts
  private requireEvent(eventId: string) {
    return this.floorPlanWorkflowService.requireEvent(eventId);
  }
```

(Keep the private wrapper method and its name/call sites unchanged — every
call site in the controller already calls `this.requireEvent(eventId)`, so
no other line in the file needs to change.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm --workspace prism-api run test -- controllers/event-floorplans.controller.test.ts`
Expected: PASS

Run: `npm --workspace prism-api run test -- services/floor-plan-workflow.service.test.ts`
Expected: PASS (unchanged)

- [ ] **Step 6: Typecheck and boundary check**

Run: `npm run typecheck`
Expected: no errors

Run: `node ~/.agents/skills/backend-architecture/scripts/check-boundaries.mjs apps/api --paths libs/modules/floorplan --fail-on error`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add apps/api/libs/modules/floorplan
git commit -m "refactor(floorplan): move opsEvent lookup out of controller into service"
```

---

### Task 3: Delete dead `apps/client/src/app/App.tsx` (FE-cleanup)

**Files:**
- Delete: `apps/client/src/app/App.tsx`

**Interfaces:** none — this file has zero importers anywhere in
`apps/client/src` (verified by repo-wide grep during the review), and it
sits outside the Next.js App Router file convention (`app/`` only recognizes
`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`,
`template.tsx`, `route.ts`, and `default.tsx` — `App.tsx` is none of these
and is never rendered by the router).

- [ ] **Step 1: Confirm zero importers (repeat the check before deleting)**

Run (PowerShell):
```powershell
Get-ChildItem -Path apps\client\src -Recurse -Include *.ts,*.tsx | Select-String -Pattern 'from ["\x27].*[/\\]App["\x27]|import App '
```
Expected: no output (zero matches)

- [ ] **Step 2: Delete the file**

```bash
git rm apps/client/src/app/App.tsx
```

- [ ] **Step 3: Verify the app still builds**

Run: `npm --workspace @prism/client run build`
Expected: build succeeds, no missing-module errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(client): remove dead App.tsx outside App Router convention"
```

---

### Task 4: Introduce route groups in `apps/client` (F4a)

**Files:**
- Move: `apps/client/src/app/sign-in/page.tsx` → `apps/client/src/app/(access)/sign-in/page.tsx`
- Move: `apps/client/src/app/sign-up/page.tsx` → `apps/client/src/app/(access)/sign-up/page.tsx`
- Move: `apps/client/src/app/dashboard/**` (entire subtree, all files) → `apps/client/src/app/(portal)/dashboard/**`
- Move: `apps/client/src/app/inquiry/page.tsx` → `apps/client/src/app/(public)/inquiry/page.tsx`
- Keep in place: `apps/client/src/app/page.tsx`, `layout.tsx`, `globals.css`, `components/`

**Interfaces:** none — route groups `(name)` are invisible to the URL by
Next.js App Router convention. `/sign-in` still resolves to `/sign-in`,
`/dashboard/events` still resolves to `/dashboard/events`, etc. No import
paths change because nothing outside `app/` imports from inside `app/` (per
the `next-feature-architecture` rule that routes only compose `features/*`
views, never the reverse).

- [ ] **Step 1: Snapshot current routes for a before/after diff**

Run (PowerShell), save the output as a comparison baseline (paste into a
scratch file or keep the terminal open — do not commit this list):
```powershell
Get-ChildItem -Path apps\client\src\app -Recurse -Filter "page.tsx" | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\\', '') }
```

- [ ] **Step 2: Create the route-group folders and move files with `git mv`**

```bash
mkdir -p "apps/client/src/app/(access)" "apps/client/src/app/(portal)" "apps/client/src/app/(public)"
git mv apps/client/src/app/sign-in "apps/client/src/app/(access)/sign-in"
git mv apps/client/src/app/sign-up "apps/client/src/app/(access)/sign-up"
git mv apps/client/src/app/dashboard "apps/client/src/app/(portal)/dashboard"
git mv apps/client/src/app/inquiry "apps/client/src/app/(public)/inquiry"
```

- [ ] **Step 3: Verify no file content needs to change**

Route groups do not change any import path inside the moved files (they all
use the `@/features/...` alias, never a relative path back up through
`app/`). Confirm with:
```powershell
Select-String -Path "apps/client/src/app/(portal)/dashboard/**/*.tsx" -Pattern '\.\./\.\./app' -Recurse
```
Expected: no output (confirms no broken relative imports)

- [ ] **Step 4: Build and confirm every route still resolves**

Run: `npm --workspace @prism/client run build`
Expected: build succeeds; the Next.js build output route list shows the same
URLs as the Step 1 snapshot (e.g. `/sign-in`, `/dashboard`,
`/dashboard/events/[eventId]/[section]`, `/inquiry`) — route groups do not
appear in the build output route list.

- [ ] **Step 5: Manual smoke check (if dev stack is up)**

Start `apps/client` dev server (`npm --workspace @prism/client run dev`) and
click through: `/` → `/sign-in` → (mock sign-in) → `/dashboard` →
`/dashboard/events` → `/inquiry`. Confirm every URL in the address bar is
unchanged from before this task.

- [ ] **Step 6: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/client --src auto --fail-on error`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(client): group routes with (access)/(portal)/(public), no URL change"
```

---

### Task 5: Introduce route groups in `apps/event` (F4a)

**Files:**
- Move: `apps/event/src/app/sign-in/page.tsx` → `apps/event/src/app/(access)/sign-in/page.tsx`
- Move: `apps/event/src/app/dashboard/**` (entire subtree) → `apps/event/src/app/(portal)/dashboard/**`
- Keep in place: `apps/event/src/app/page.tsx`, `layout.tsx`, `globals.css`, `components/`, `lib/`

**Interfaces:** none — same route-group mechanics as Task 4.

- [ ] **Step 1: Snapshot current routes**

```powershell
Get-ChildItem -Path apps\event\src\app -Recurse -Filter "page.tsx" | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\\', '') }
```

- [ ] **Step 2: Create route-group folders and move**

```bash
mkdir -p "apps/event/src/app/(access)" "apps/event/src/app/(portal)"
git mv apps/event/src/app/sign-in "apps/event/src/app/(access)/sign-in"
git mv apps/event/src/app/dashboard "apps/event/src/app/(portal)/dashboard"
```

- [ ] **Step 3: Verify `apps/event/src/app/lib/session.ts` (imported via
`@/app/lib/session` from many features) is untouched**

This file lives at `apps/event/src/app/lib/`, a sibling of `dashboard/` and
`sign-in/`, not inside either — confirm it was **not** moved:
```powershell
Test-Path "apps/event/src/app/lib/session.ts"
```
Expected: `True`

- [ ] **Step 4: Build and confirm route parity**

Run: `npm --workspace @prism/event run build`
Expected: build succeeds; route list unchanged from Step 1 snapshot
(`/sign-in`, `/dashboard`, `/dashboard/events/[eventId]/[eventView]`, etc.)

- [ ] **Step 5: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/event --src auto --fail-on error`
Expected: 0 errors (the pre-existing F1 violation is out of scope for this
task — do not fix it here, it's Task 8)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(event): group routes with (access)/(portal), no URL change"
```

---

### Task 6: Introduce route groups in `apps/guest` (F4a)

**Files:**
- Move: `apps/guest/src/app/sign-in/page.tsx` → `apps/guest/src/app/(access)/sign-in/page.tsx`
- Move: `apps/guest/src/app/open/page.tsx` → `apps/guest/src/app/(access)/open/page.tsx`
- Move: `apps/guest/src/app/dashboard/**` → `apps/guest/src/app/(portal)/dashboard/**`
- Move: `apps/guest/src/app/info/[accessCode]/page.tsx` → `apps/guest/src/app/(public)/info/[accessCode]/page.tsx`
- Keep in place: `apps/guest/src/app/page.tsx`, `layout.tsx`, `globals.css`, `components/`

**Interfaces:** none.

- [ ] **Step 1: Snapshot current routes**

```powershell
Get-ChildItem -Path apps\guest\src\app -Recurse -Filter "page.tsx" | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\\', '') }
```

- [ ] **Step 2: Create route-group folders and move**

```bash
mkdir -p "apps/guest/src/app/(access)" "apps/guest/src/app/(portal)" "apps/guest/src/app/(public)"
git mv apps/guest/src/app/sign-in "apps/guest/src/app/(access)/sign-in"
git mv apps/guest/src/app/open "apps/guest/src/app/(access)/open"
git mv apps/guest/src/app/dashboard "apps/guest/src/app/(portal)/dashboard"
git mv apps/guest/src/app/info "apps/guest/src/app/(public)/info"
```

Note: `apps/guest/src/app/sign-in/page.tsx` currently redirects to `/open`
(`redirect("/open")`) — this redirect target is a URL string, not an import
path, so it needs no edit; `/open` still resolves correctly after the move.

- [ ] **Step 3: Build and confirm route parity**

Run: `npm --workspace @prism/guest run build`
Expected: build succeeds; route list unchanged (`/sign-in`, `/open`,
`/dashboard`, `/info/[accessCode]`)

- [ ] **Step 4: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/guest --src auto --fail-on error`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(guest): group routes with (access)/(portal)/(public), no URL change"
```

---

### Task 7: Introduce route groups in `apps/supplier` (F4a)

**Files:**
- Move: `apps/supplier/src/app/sign-in/page.tsx` → `apps/supplier/src/app/(access)/sign-in/page.tsx`
- Move: `apps/supplier/src/app/apply/page.tsx` → `apps/supplier/src/app/(public)/apply/page.tsx`
- Move: `apps/supplier/src/app/dashboard/**` → `apps/supplier/src/app/(portal)/dashboard/**`
- Keep in place: `apps/supplier/src/app/page.tsx`, `layout.tsx`, `globals.css`, `components/`

**Interfaces:** none.

- [ ] **Step 1: Snapshot current routes**

```powershell
Get-ChildItem -Path apps\supplier\src\app -Recurse -Filter "page.tsx" | ForEach-Object { $_.FullName.Replace((Get-Location).Path + '\\', '') }
```

- [ ] **Step 2: Create route-group folders and move**

```bash
mkdir -p "apps/supplier/src/app/(access)" "apps/supplier/src/app/(portal)" "apps/supplier/src/app/(public)"
git mv apps/supplier/src/app/sign-in "apps/supplier/src/app/(access)/sign-in"
git mv apps/supplier/src/app/apply "apps/supplier/src/app/(public)/apply"
git mv apps/supplier/src/app/dashboard "apps/supplier/src/app/(portal)/dashboard"
```

- [ ] **Step 3: Build and confirm route parity**

Run: `npm --workspace @prism/supplier run build`
Expected: build succeeds; route list unchanged (`/sign-in`, `/apply`,
`/dashboard`)

- [ ] **Step 4: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/supplier --src auto --fail-on error`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(supplier): group routes with (access)/(portal)/(public), no URL change"
```

---

### Task 8: Consolidate duplicated selectors across 3 features (F1)

**Files:**
- Modify: `apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts`
- Modify: `apps/event/src/features/event-dashboard/shell/index.ts`
- Modify: `apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts`
- No change: `apps/event/src/features/event-workspace/shell/model/event-workspace-selectors.ts` (already the correct canonical owner of `selectActiveEvents`, `selectSelectedEvent`, `selectPendingApprovals`, `selectEventWorkspaceResources`, `selectSelectedEventWorkspaceResources`)
- No change: `apps/event/src/features/command-inbox/list/model/command-inbox-selectors.ts` (already the correct canonical owner of `selectCommandInboxGroupedBySeverity`, `selectCommandInboxItemsBySeverity`)

**Interfaces:**
- Consumes: `@/features/event-workspace/shell` barrel exports (`selectActiveEvents`, `selectSelectedEvent`, `selectPendingApprovals`, `selectEventWorkspaceResources`), `@/features/command-inbox/list` barrel exports (`selectCommandInboxGroupedBySeverity`) — both already exported from those features' `index.ts`, confirmed present.
- Produces: unchanged public surface — `@/features/event-dashboard/shell`'s barrel keeps re-exporting the same names for its own 8 downstream consumers (6 views, 1 data file, 1 VM), so no consumer of `event-dashboard/shell` needs to change.

**Root cause being fixed:** `event-dashboard-selectors.ts` currently does
`export { selectActiveEvents, ... } from "@/features/event-workspace/shell/model/event-workspace-selectors";`
— a **deep** import into another feature's internal `model/` folder. The fix
is not to move the selectors (they are already correctly owned by
`event-workspace/shell` and `command-inbox/list`) — it is to import them
through those features' **barrels** instead of reaching into their
internals, per `domain-sharing.md`: "Outside `orders`, import only barrels."

- [ ] **Step 1: Confirm the current violation**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/event --src auto --json`
Expected: 2 findings, both `rule: "no-cross-feature-deep"`, both in
`src/features/event-dashboard/shell/model/event-dashboard-selectors.ts`

- [ ] **Step 2: Fix the two re-export blocks**

In `apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts`,
replace the two trailing re-export blocks:

```ts
// Re-export workspace selectors for shell composition convenience
export {
  selectActiveEvents,
  selectEventWorkspaceResources,
  selectPendingApprovals,
  selectSelectedEvent,
  selectSelectedEventWorkspaceResources,
} from "@/features/event-workspace/shell/model/event-workspace-selectors";

// Re-export command-inbox selectors for shell composition convenience
export {
  selectCommandInboxGroupedBySeverity,
  selectCommandInboxItemsBySeverity,
} from "@/features/command-inbox/list/model/command-inbox-selectors";
```

with:

```ts
// Re-export workspace selectors for shell composition convenience.
// Imported via the feature barrel, not the internal model/ file — see
// docs/reviews/2026-09-01-fe-be-architecture-alignment.md (finding F1).
export {
  selectActiveEvents,
  selectEventWorkspaceResources,
  selectPendingApprovals,
  selectSelectedEvent,
  selectSelectedEventWorkspaceResources,
} from "@/features/event-workspace/shell";

// Re-export command-inbox selectors for shell composition convenience.
export {
  selectCommandInboxGroupedBySeverity,
  selectCommandInboxItemsBySeverity,
} from "@/features/command-inbox/list";
```

- [ ] **Step 3: Confirm both barrels actually export these names**

Run (PowerShell):
```powershell
Select-String -Path "apps/event/src/features/event-workspace/shell/index.ts" -Pattern "selectActiveEvents|selectEventWorkspaceResources|selectPendingApprovals|selectSelectedEvent|selectSelectedEventWorkspaceResources"
Select-String -Path "apps/event/src/features/command-inbox/list/index.ts" -Pattern "selectCommandInboxGroupedBySeverity|selectCommandInboxItemsBySeverity"
```
Expected: all 7 names found (both barrels already export all of them — verified
during the review; no change needed to either barrel).

- [ ] **Step 4: Run the boundary checker again**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/event --src auto --json`
Expected: 0 findings

- [ ] **Step 5: Typecheck**

Run: `npm --workspace @prism/event run typecheck`
Expected: no errors (the import target changed but every exported name and
type is identical, so no consumer type changes)

- [ ] **Step 6: Run existing selector tests**

Run: `npm --workspace @prism/event run test -- event-dashboard-selectors.test.ts event-workspace-selectors.test.ts command-inbox-selectors.test.ts`
Expected: PASS (all pre-existing, unmodified — these tests exercise the
selector functions directly, not the re-export path, so behavior is
identical)

- [ ] **Step 7: Manual smoke check**

Start `apps/event` dev server and visit the dashboard home, the events list,
and the command inbox — confirm client records, active events, pending
approvals, and the command inbox severity grouping all render exactly as
before (these all flow through `use-event-dashboard-shell-view-model.ts`,
which imports these selectors from `event-dashboard/shell`'s barrel — an
import path this task does not touch).

- [ ] **Step 8: Commit**

```bash
git add apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts
git commit -m "fix(event): import shared selectors via feature barrels, not internals"
```

---

### Task 9: Add a thin `domain/` layer to `live-ops` (B1)

**Files:**
- Create: `apps/api/libs/modules/live-ops/src/domain/urgent-issue-status.policy.ts`
- Create: `apps/api/libs/modules/live-ops/src/domain/urgent-issue-status.policy.test.ts`
- Create: `apps/api/libs/modules/live-ops/src/domain/live-ops-escalation.policy.ts`
- Create: `apps/api/libs/modules/live-ops/src/domain/live-ops-escalation.policy.test.ts`
- Modify: `apps/api/libs/modules/live-ops/src/services/live-operations.service.ts`
- Modify: `apps/api/libs/modules/live-ops/src/index.ts`

**Interfaces:**
- Produces: `resolveUrgentIssueStatusOnCreate(input: { ownerRole?: string; ownerName?: string }): UrgentIssueStatus`
- Produces: `isTerminalUrgentIssueStatus(status: string): boolean`
- Produces: `resolveEscalationLevel(value?: string): LiveOpsEscalationLevelValue` (throws `EscalationPolicyViolation` on an unsupported value)
- Produces: `class EscalationPolicyViolation extends Error` with a `message` matching the current `BadRequestException` text exactly, so the service layer can catch it and re-throw as `BadRequestException` (keeping the domain layer framework-independent per `backend-architecture`'s rule: "domain must not depend on a web framework").
- Consumes (in the service): the two policy functions above, plus existing `UrgentIssueStatus`, `LiveOpsEscalationLevel` from `@prism/modules/event-core` (unchanged import).

**Root cause being fixed:** `live-operations.service.ts` (732 lines) currently
inlines two business rules directly in service methods: (1) an urgent issue's
initial status is `Assigned` if an owner is given at creation, else `Open`
(currently a ternary inside `createUrgentIssue`'s `write` callback); (2) which
escalation levels are valid (currently the private
`validateEscalationLevel` method, which throws a Nest `BadRequestException`
directly — a framework dependency inside otherwise-pure logic). Per
`backend-architecture`'s decision guide ("is there a business rule that must
remain true regardless of transport or persistence? put it in a domain
policy"), both belong in `domain/`. This task extracts them exactly as they
behave today — no new validation, no behavior change.

- [ ] **Step 1: Write the failing tests for the new domain module**

Create `apps/api/libs/modules/live-ops/src/domain/urgent-issue-status.policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { UrgentIssueStatus } from '@prism/modules/event-core';
import { isTerminalUrgentIssueStatus, resolveUrgentIssueStatusOnCreate } from './urgent-issue-status.policy';

describe('resolveUrgentIssueStatusOnCreate', () => {
  it('resolves to Assigned when an owner role is given', () => {
    expect(resolveUrgentIssueStatusOnCreate({ ownerRole: 'coordinator' })).toBe(UrgentIssueStatus.Assigned);
  });

  it('resolves to Assigned when an owner name is given', () => {
    expect(resolveUrgentIssueStatusOnCreate({ ownerName: 'Maxine' })).toBe(UrgentIssueStatus.Assigned);
  });

  it('resolves to Open when no owner is given', () => {
    expect(resolveUrgentIssueStatusOnCreate({})).toBe(UrgentIssueStatus.Open);
  });
});

describe('isTerminalUrgentIssueStatus', () => {
  it('treats resolved and cancelled as terminal', () => {
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Resolved)).toBe(true);
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Cancelled)).toBe(true);
  });

  it('treats open and assigned as non-terminal', () => {
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Open)).toBe(false);
    expect(isTerminalUrgentIssueStatus(UrgentIssueStatus.Assigned)).toBe(false);
  });
});
```

Create `apps/api/libs/modules/live-ops/src/domain/live-ops-escalation.policy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { LiveOpsEscalationLevel } from '@prism/modules/event-core';
import { EscalationPolicyViolation, resolveEscalationLevel } from './live-ops-escalation.policy';

describe('resolveEscalationLevel', () => {
  it('defaults to RoleLead when no value is given', () => {
    expect(resolveEscalationLevel(undefined)).toBe(LiveOpsEscalationLevel.RoleLead);
  });

  it('accepts RoleLead, Pmcm, and Critical', () => {
    expect(resolveEscalationLevel('role_lead')).toBe(LiveOpsEscalationLevel.RoleLead);
    expect(resolveEscalationLevel('pmcm')).toBe(LiveOpsEscalationLevel.Pmcm);
    expect(resolveEscalationLevel('critical')).toBe(LiveOpsEscalationLevel.Critical);
  });

  it('rejects None even though it is a valid ops constant', () => {
    expect(() => resolveEscalationLevel('none')).toThrow(EscalationPolicyViolation);
  });

  it('rejects an unknown value', () => {
    expect(() => resolveEscalationLevel('made-up-level')).toThrow(EscalationPolicyViolation);
  });

  it('trims whitespace before validating', () => {
    expect(resolveEscalationLevel('  critical  ')).toBe(LiveOpsEscalationLevel.Critical);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --workspace prism-api run test -- domain/urgent-issue-status.policy.test.ts domain/live-ops-escalation.policy.test.ts`
Expected: FAIL — `Cannot find module './urgent-issue-status.policy'` /
`'./live-ops-escalation.policy'`

- [ ] **Step 3: Write the domain modules**

Create `apps/api/libs/modules/live-ops/src/domain/urgent-issue-status.policy.ts`:

```ts
import { UrgentIssueStatus, type UrgentIssueStatus as UrgentIssueStatusValue } from '@prism/modules/event-core';

const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  UrgentIssueStatus.Resolved,
  UrgentIssueStatus.Cancelled,
]);

/**
 * An urgent issue opens as Assigned when an owner is already known at
 * creation time, otherwise it opens as Open (unassigned).
 */
export function resolveUrgentIssueStatusOnCreate(input: {
  ownerRole?: string;
  ownerName?: string;
}): UrgentIssueStatusValue {
  return input.ownerRole || input.ownerName ? UrgentIssueStatus.Assigned : UrgentIssueStatus.Open;
}

export function isTerminalUrgentIssueStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
```

Create `apps/api/libs/modules/live-ops/src/domain/live-ops-escalation.policy.ts`:

```ts
import { LiveOpsEscalationLevel, isOpsConstantValue } from '@prism/modules/event-core';

type LiveOpsEscalationLevelValue = (typeof LiveOpsEscalationLevel)[keyof typeof LiveOpsEscalationLevel];

const ESCALATABLE_LEVELS: readonly LiveOpsEscalationLevelValue[] = [
  LiveOpsEscalationLevel.RoleLead,
  LiveOpsEscalationLevel.Pmcm,
  LiveOpsEscalationLevel.Critical,
];

/**
 * Framework-independent policy violation. Service callers translate this
 * into a transport-specific error (e.g. Nest's BadRequestException).
 */
export class EscalationPolicyViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EscalationPolicyViolation';
  }
}

/**
 * Resolves and validates a requested escalation level. `none` is a valid
 * ops constant (the resting state before any escalation) but is not a
 * level a caller may escalate *to* — escalation always moves to
 * RoleLead, Pmcm, or Critical.
 */
export function resolveEscalationLevel(value?: string): LiveOpsEscalationLevelValue {
  const escalationLevel = value?.trim();
  if (!escalationLevel) return LiveOpsEscalationLevel.RoleLead;

  if (
    !isOpsConstantValue(LiveOpsEscalationLevel, escalationLevel) ||
    !ESCALATABLE_LEVELS.some((allowedLevel) => allowedLevel === escalationLevel)
  ) {
    throw new EscalationPolicyViolation('Unsupported escalation level');
  }

  return escalationLevel as LiveOpsEscalationLevelValue;
}
```

- [ ] **Step 4: Run the domain tests to verify they pass**

Run: `npm --workspace prism-api run test -- domain/urgent-issue-status.policy.test.ts domain/live-ops-escalation.policy.test.ts`
Expected: PASS (all 9 tests)

- [ ] **Step 5: Wire the domain policies into the service**

In `apps/api/libs/modules/live-ops/src/services/live-operations.service.ts`:

1. Add the import (near the other `@prism/modules/event-core` import):
```ts
import { resolveUrgentIssueStatusOnCreate } from '../domain/urgent-issue-status.policy';
import { EscalationPolicyViolation, resolveEscalationLevel } from '../domain/live-ops-escalation.policy';
```

2. In `createUrgentIssue`, replace this line inside the `write` callback:
```ts
            status: input.ownerRole || input.ownerName ? UrgentIssueStatus.Assigned : UrgentIssueStatus.Open,
```
with:
```ts
            status: resolveUrgentIssueStatusOnCreate(input),
```

3. Delete the private `validateEscalationLevel` method entirely (it is
   replaced by the domain function).

4. Replace both call sites of `this.validateEscalationLevel(input.escalationLevel)`
   (one in `escalateEventDayTask`, one in `escalateUrgentIssue`) with:
```ts
        try {
          escalationLevel = resolveEscalationLevel(input.escalationLevel);
        } catch (error) {
          if (error instanceof EscalationPolicyViolation) {
            throw new BadRequestException(error.message);
          }
          throw error;
        }
```
   (Both call sites currently read `escalationLevel = this.validateEscalationLevel(input.escalationLevel);`
   inside a `validateState` closure that already may throw
   `BadRequestException` for other reasons — this preserves that exact
   external behavior: an unsupported escalation level still surfaces as a
   400 with message `'Unsupported escalation level'`.)

- [ ] **Step 6: Export the new domain modules from the feature's index**

Add to `apps/api/libs/modules/live-ops/src/index.ts`:
```ts
export * from './domain/urgent-issue-status.policy';
export * from './domain/live-ops-escalation.policy';
```

- [ ] **Step 7: Run the full live-ops test suite**

Run: `npm --workspace prism-api run test -- libs/modules/live-ops`
Expected: PASS — same pass count as before this task, plus the 9 new domain
tests (verify `live-operations.service.test.ts` and
`event-live-ops-command.service.test.ts`-equivalent coverage is unchanged;
this task does not add or remove any existing test)

- [ ] **Step 8: Typecheck and boundary check**

Run: `npm run typecheck`
Expected: no errors

Run: `node ~/.agents/skills/backend-architecture/scripts/check-boundaries.mjs apps/api --paths libs/modules/live-ops --fail-on error`
Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add apps/api/libs/modules/live-ops
git commit -m "refactor(live-ops): extract urgent-issue status and escalation policy into domain/"
```

---

### Task 10: Merge `events`, `plans`, `templates`, `publishing` into one `floorplan-authoring` module

**Files:**
- Create: `apps/api/libs/modules/floorplan-authoring/src/{index.ts,floorplan-authoring.module.ts}`
- Create: `apps/api/libs/modules/floorplan-authoring/src/controllers/{layout-events,plans,templates,publish}.controller.ts` (renamed, content unchanged from source)
- Create: `apps/api/libs/modules/floorplan-authoring/src/services/{layout-events,plans,templates,publish}.service.ts` (renamed, content unchanged from source)
- Create: `apps/api/libs/modules/floorplan-authoring/src/dto/create-event.dto.ts`, `create-template.dto.ts`, `update-template.dto.ts`, `update-plan.dto.ts` (moved, content unchanged)
- Delete: `apps/api/libs/modules/events/`, `apps/api/libs/modules/plans/`, `apps/api/libs/modules/templates/`, `apps/api/libs/modules/publishing/` (entire directories)
- Modify: `apps/api/apps/api/src/app.module.ts` (4 imports/registrations → 1)
- Modify: `apps/api/nest-cli.json` (4 project entries → 1)
- Modify: `apps/api/tsconfig.json` (4 path-alias pairs → 1 pair)

**Interfaces:** No public HTTP contract changes. Every existing route
(`GET/POST /api/layout-events`, `GET /api/plans/:planId`,
`GET /api/plans/:planId/export`, `GET/POST /api/templates`,
`GET /api/templates/:templateId`, `POST /api/publish/events/:eventId`,
`GET /api/publish/:slug`) keeps its exact path and controller class
behavior. Only the internal module/file organization changes.

**IMPORTANT — do not start this task until Step 1 is confirmed.** This is
explicitly gated in the priority/risk matrix: static grep found 0 FE callers,
but that alone does not prove the routes are safe to reorganize.

- [ ] **Step 1: Confirm zero external consumers (blocking gate)**

Run each of these and record the result before proceeding:

1. Re-confirm no FE caller (already checked, re-verify no drift since the
   review):
```powershell
Select-String -Path "apps/client/src/lib/prism-api.ts","apps/event/src/lib/prism-api.ts","apps/guest/src/lib/prism-api.ts","apps/supplier/src/lib/prism-api.ts" -Pattern "api/templates|api/plans/|api/publish/|api/layout-events"
```
Expected: no output (matches the review's finding)

2. Check for any script under `apps/api/scripts` referencing these routes:
```powershell
Select-String -Path "apps/api/scripts/*.mjs","apps/api/scripts/*.cjs" -Pattern "layout-events|/plans|/templates|/publish"
```
Expected: no output

3. Check `docs/prism-v4/01-complete-feature-catalog.md` and
   `docs/prism-v4/11-feature-ledger.md` for any explicit reference to these
   as a shipped, currently-used feature (not just a data-model mention):
```powershell
Select-String -Path "docs/prism-v4/01-complete-feature-catalog.md","docs/prism-v4/11-feature-ledger.md" -Pattern "layout-events|venue template|floor plan template|published.{0,10}snapshot" -SimpleMatch:$false
```
Read any hits manually — if a hit describes these as an actively-used
feature (not "legacy" or "unused"), **stop this task** and flag it back
for a product decision before proceeding.

If all three checks come back clean (as they did during the review), proceed.

- [ ] **Step 2: Create the new module skeleton**

```bash
mkdir -p apps/api/libs/modules/floorplan-authoring/src/{controllers,services,dto}
```

Create `apps/api/libs/modules/floorplan-authoring/src/index.ts`:
```ts
export * from './floorplan-authoring.module';
```

- [ ] **Step 3: Move each source file with `git mv`, renaming for clarity**

```bash
git mv apps/api/libs/modules/events/src/dto/create-event.dto.ts apps/api/libs/modules/floorplan-authoring/src/dto/create-event.dto.ts
git mv apps/api/libs/modules/events/src/events.controller.ts apps/api/libs/modules/floorplan-authoring/src/controllers/layout-events.controller.ts
git mv apps/api/libs/modules/events/src/events.service.ts apps/api/libs/modules/floorplan-authoring/src/services/layout-events.service.ts

git mv apps/api/libs/modules/plans/src/update-plan.dto.ts apps/api/libs/modules/floorplan-authoring/src/dto/update-plan.dto.ts
git mv apps/api/libs/modules/plans/src/plans.controller.ts apps/api/libs/modules/floorplan-authoring/src/controllers/plans.controller.ts
git mv apps/api/libs/modules/plans/src/plans.service.ts apps/api/libs/modules/floorplan-authoring/src/services/plans.service.ts
git mv apps/api/libs/modules/plans/src/plans.service.test.ts apps/api/libs/modules/floorplan-authoring/src/services/plans.service.test.ts
git mv apps/api/libs/modules/plans/src/plans.controller.test.ts apps/api/libs/modules/floorplan-authoring/src/controllers/plans.controller.test.ts

git mv apps/api/libs/modules/templates/src/dto/create-template.dto.ts apps/api/libs/modules/floorplan-authoring/src/dto/create-template.dto.ts
git mv apps/api/libs/modules/templates/src/dto/update-template.dto.ts apps/api/libs/modules/floorplan-authoring/src/dto/update-template.dto.ts
git mv apps/api/libs/modules/templates/src/templates.controller.ts apps/api/libs/modules/floorplan-authoring/src/controllers/templates.controller.ts
git mv apps/api/libs/modules/templates/src/templates.service.ts apps/api/libs/modules/floorplan-authoring/src/services/templates.service.ts
git mv apps/api/libs/modules/templates/src/templates.service.test.ts apps/api/libs/modules/floorplan-authoring/src/services/templates.service.test.ts

git mv apps/api/libs/modules/publishing/src/publish.controller.ts apps/api/libs/modules/floorplan-authoring/src/controllers/publish.controller.ts
git mv apps/api/libs/modules/publishing/src/publish.service.ts apps/api/libs/modules/floorplan-authoring/src/services/publish.service.ts
```

- [ ] **Step 4: Fix relative import paths inside the moved files**

Every moved file imports its DTO with a relative path one level shallower
than before (e.g. `events.controller.ts` had `import { CreateEventDto } from './dto/create-event.dto';`
at `libs/modules/events/src/`; the file is now at
`libs/modules/floorplan-authoring/src/controllers/`, two levels deep, so the
import must become `'../dto/create-event.dto'`). Apply these exact edits:

In `controllers/layout-events.controller.ts`: change
`import { CreateEventDto } from './dto/create-event.dto';` to
`import { CreateEventDto } from '../dto/create-event.dto';`, and
`import { EventsService } from './events.service';` to
`import { LayoutEventsService } from '../services/layout-events.service';`
(also rename the class `EventsService` → `LayoutEventsService` in
`services/layout-events.service.ts`'s `export class` line and every
reference to it in the controller, to avoid a name collision risk with any
future `EventsService`-named class).

In `controllers/plans.controller.ts`: change
`import { UpdatePlanDto } from './update-plan.dto';` (or equivalent existing
relative import) to `import { UpdatePlanDto } from '../dto/update-plan.dto';`,
and the service import to `from '../services/plans.service'`.

In `controllers/templates.controller.ts`: change the two DTO imports to
`'../dto/create-template.dto'` and `'../dto/update-template.dto'`, and the
service import to `from '../services/templates.service'`.

In `controllers/publish.controller.ts`: change the service import to
`from '../services/publish.service'`.

In each `.test.ts` file moved in Step 3, fix the relative import to the
controller/service under test the same way (one directory level shallower
than before the move — verify with the file's own current import line before
editing, since exact original paths differ slightly per file).

- [ ] **Step 5: Write the consolidated module**

Create `apps/api/libs/modules/floorplan-authoring/src/floorplan-authoring.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { LayoutEventsController } from './controllers/layout-events.controller';
import { PlansController } from './controllers/plans.controller';
import { TemplatesController } from './controllers/templates.controller';
import { PublishController } from './controllers/publish.controller';
import { LayoutEventsService } from './services/layout-events.service';
import { PlansService } from './services/plans.service';
import { TemplatesService } from './services/templates.service';
import { PublishService } from './services/publish.service';

@Module({
  imports: [DatabaseModule],
  controllers: [LayoutEventsController, PlansController, TemplatesController, PublishController],
  providers: [LayoutEventsService, PlansService, TemplatesService, PublishService],
})
export class FloorplanAuthoringModule {}
```

(Verify each controller's exact class name matches what Step 3/4 produced —
adjust the import/class names above if a controller class was not renamed.)

- [ ] **Step 6: Delete the 4 old module directories**

```bash
git rm -r apps/api/libs/modules/events apps/api/libs/modules/plans apps/api/libs/modules/templates apps/api/libs/modules/publishing
```

- [ ] **Step 7: Update `nest-cli.json`**

In `apps/api/nest-cli.json`, remove the 4 `"events"`, `"plans"`,
`"templates"`, `"publishing"` entries under `"projects"` and add one:

```json
"floorplan-authoring": {
  "type": "library",
  "root": "libs/modules/floorplan-authoring",
  "entryFile": "index",
  "sourceRoot": "libs/modules/floorplan-authoring/src",
  "compilerOptions": {
    "tsConfigPath": "libs/modules/floorplan-authoring/tsconfig.lib.json"
  }
}
```

- [ ] **Step 8: Add the missing `tsconfig.lib.json`**

Check what an existing sibling module's `tsconfig.lib.json` looks like and
copy its shape exactly (e.g. `apps/api/libs/modules/plans/tsconfig.lib.json`
— read it before deleting the `plans` directory in Step 6, or restore it from
git history if already deleted) into
`apps/api/libs/modules/floorplan-authoring/tsconfig.lib.json`.

- [ ] **Step 9: Update `apps/api/tsconfig.json` path aliases**

Remove the 4 path-alias pairs for `@prism/modules/events`,
`@prism/modules/plans`, `@prism/modules/templates`,
`@prism/modules/publishing` (8 lines total — each has a bare and a `/*`
variant) and add one pair:

```json
"@prism/modules/floorplan-authoring": ["libs/modules/floorplan-authoring/src/index"],
"@prism/modules/floorplan-authoring/*": ["libs/modules/floorplan-authoring/src/*"]
```

- [ ] **Step 10: Update `app.module.ts`**

In `apps/api/apps/api/src/app.module.ts`, replace:
```ts
import { EventsModule } from '@prism/modules/events';
...
import { PlansModule } from '@prism/modules/plans';
import { PublishingModule } from '@prism/modules/publishing';
...
import { TemplatesModule } from '@prism/modules/templates';
```
with a single:
```ts
import { FloorplanAuthoringModule } from '@prism/modules/floorplan-authoring';
```
And in the `imports: [...]` array, replace the 4 entries
(`TemplatesModule, EventsModule, ... PlansModule, PublishingModule`, in
whatever positions they currently occupy) with one `FloorplanAuthoringModule`
entry, keeping every other module in its existing position.

- [ ] **Step 11: Run the full backend test suite**

Run: `npm --workspace prism-api run test`
Expected: PASS — identical pass count to before this task (no test was added
or removed, only moved)

- [ ] **Step 12: Typecheck, build, and validate**

Run: `npm run typecheck` — expected: no errors
Run: `npm --workspace prism-api run build` — expected: succeeds
Run: `npm --workspace prism-api run prisma:validate` — expected: succeeds (no
schema change in this task, this only confirms nothing else broke)

- [ ] **Step 13: Manual route smoke check (if stack is up)**

Start the API (`npm run dev:api`) and confirm each route still responds
with its expected shape: `GET /api/layout-events`, `GET /api/templates`,
`GET /api/plans/:planId` (with a real planId from seed data),
`GET /api/publish/:slug` (404 for a nonexistent slug is fine — confirms the
route is wired, not a 404 from routing itself).

- [ ] **Step 14: Boundary check**

Run: `node ~/.agents/skills/backend-architecture/scripts/check-boundaries.mjs apps/api --paths libs/modules/floorplan-authoring --fail-on error`
Expected: 0 errors

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "refactor(api): merge events/plans/templates/publishing into floorplan-authoring"
```

---

### Task 11: Scope the event dashboard layout per section (F6)

**Files:**
- Create: `apps/event/src/features/event-dashboard/shell/views/audit-section-layout.tsx`
- Modify: `apps/event/src/app/(portal)/dashboard/audit/layout.tsx` (new file)
- No change (yet) to `apps/event/src/app/(portal)/dashboard/layout.tsx` — it
  keeps rendering `<EventDashboardShellView />` for every other section;
  this task carves out **one** section (`audit`, the smallest/simplest) as
  the proof of the pattern, matching `alphaci-enterprise-fe`'s
  `(platform)/admin/layout.tsx` shape. Remaining sections are carved out
  incrementally in follow-up work, not in this task (see Task 14's note on
  incremental scope).

**Interfaces:**
- Consumes: existing `EventDashboardShellView` (unchanged), existing
  `apps/event/src/app/(portal)/dashboard/audit/page.tsx` (unchanged — still a
  `routeKey="audit"` shim for this task; Task 14 replaces the shim itself).
- Produces: nothing new consumed elsewhere — this is a leaf layout.

**Why `audit` first:** it is the simplest section (a single
`system-logs` view, no sub-tabs, no dynamic `[param]` segment), so it proves
the per-section layout pattern with the smallest blast radius before Task 14
applies it to sections with sub-routes.

- [ ] **Step 1: Confirm current behavior to preserve**

Visit `/dashboard/audit` in a running `apps/event` dev server before making
any change. Note exactly what renders (the shell chrome — sidebar, top bar —
plus the audit trail panel). This is the behavior Step 3 must reproduce
exactly.

- [ ] **Step 2: Read how `EventDashboardShellView` decides to show the audit
section today**

Run:
```powershell
Select-String -Path "apps/event/src/features/event-dashboard/shell/views/event-dashboard-shell-view.tsx" -Pattern "audit" -Context 3,3
```
Read the surrounding code to find exactly which prop/state controls
rendering the audit trail panel inside the shell (it is driven by
`routeStateFromPath`'s `section: "audit"` result, consumed by the 941-line
VM). Do not modify this file in this task — Step 3 adds a route-level layout
alongside it without touching the shell's existing rendering path.

- [ ] **Step 3: Create a scoped layout for the audit route group**

Create `apps/event/src/app/(portal)/dashboard/audit/layout.tsx`:

```tsx
import type { ReactNode } from "react";

/**
 * Scoped layout for the audit section. Currently a pass-through — the
 * shared shell in the parent (portal)/dashboard/layout.tsx still renders
 * chrome and drives section switching via pathname. This file exists as
 * the seam Task 14 uses to move audit-specific rendering out of the
 * pathname-sniffing VM without touching any other section.
 */
export default function EventDashboardAuditLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Build and confirm zero visual/behavior change**

Run: `npm --workspace @prism/event run build`
Expected: succeeds. Restart dev server, revisit `/dashboard/audit`, confirm
pixel-identical output to Step 1's baseline (a pass-through layout changes
nothing yet — this step only proves the new file doesn't break the route).

- [ ] **Step 5: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/event --src auto --paths features/event-dashboard --fail-on error`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add "apps/event/src/app/(portal)/dashboard/audit/layout.tsx"
git commit -m "feat(event): add scoped layout seam for the audit dashboard section"
```

**Note for follow-up work (out of scope for this plan):** repeating Step 3
for every remaining section (`calendar`, `clients`, `command-inbox`,
`events`, `files`, `finance`, `inquiries`, `messages`, `settings`,
`suppliers`, `tasks`, `team`) and then moving each section's actual
rendering logic (not just a pass-through) out of the shell VM is the full
F6 scope described in the priority/risk matrix. This task establishes the
pattern and does the first section; treat the remaining 11 as a tracked
follow-up, one PR per section, only after Task 12 (F3) has split the VM.

---

### Task 12: Split the 941-line mega view-model (F3)

**Files:**
- Create: `apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-nav.ts`
- Modify: `apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts`
- Modify: `apps/event/src/features/event-dashboard/shell/index.ts`
- Test: `apps/event/src/features/event-dashboard/shell/views/event-dashboard-shell-architecture.test.ts` (existing — must still pass unmodified)

**Interfaces:**
- Produces: `useEventDashboardNav(): { navItems: PrismNavItem[] }` (or the
  exact return shape the current inline nav/icon config produces — verify
  against the VM's current usage before finalizing the return type).
- Consumes (in the split-out hook): the existing `lucide-react` icon imports
  and `@prism/ui`'s `PrismNavItem` type — both already imported in the
  source VM file, moved as-is.

**Root cause being fixed:** the VM currently combines three unrelated
concerns in one 941-line file: (1) static nav/icon configuration (the
`lucide-react` icon imports and the nav item list — data that never changes
at runtime), (2) routing (`usePathname`/`useRouter`, prefetch calls), and (3)
dashboard data selection (the selector calls from Task 8). This task splits
out concern (1) only — the lowest-risk, most clearly independent piece —
leaving routing and data selection together for now (splitting those further
is a natural follow-up once F6/F4c reduce how much routing logic the VM
needs to own).

- [ ] **Step 1: Identify the exact nav/icon config block to extract**

Run:
```powershell
Select-String -Path "apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-shell-view-model.ts" -Pattern "lucide-react|PrismNavItem" -Context 0,0
```
Read the file section between the icon imports and wherever the resulting
nav item array is returned/used, to capture the exact boundary of the
static config block before extracting it.

- [ ] **Step 2: Write the failing architecture check**

The existing `event-dashboard-shell-architecture.test.ts` already asserts
something about this file's shape (read it first to confirm what it checks
— likely an import-boundary or file-size-adjacent assertion). Add one new
assertion to that file:

```ts
  it("keeps static nav configuration out of the main view-model file", () => {
    const vmSource = readFileSync(
      resolve(__dirname, "../view-models/use-event-dashboard-shell-view-model.ts"),
      "utf-8",
    );
    expect(vmSource).not.toContain("lucide-react");
  });
```

(Match the existing test file's actual import style for `readFileSync`/
`resolve`/`__dirname` or `import.meta.url` — read the file's current top
imports before adding this, since the exact pattern already used there must
be reused, not invented.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm --workspace @prism/event run test -- event-dashboard-shell-architecture.test.ts`
Expected: FAIL — the VM file still contains `lucide-react`

- [ ] **Step 4: Extract the nav/icon config into its own hook**

Create `apps/event/src/features/event-dashboard/shell/view-models/use-event-dashboard-nav.ts`
containing exactly the icon imports and the static nav-item construction
logic identified in Step 1, wrapped in a hook (or a plain exported constant,
if the config has no runtime dependency — check Step 1's findings to decide
which; a plain exported `const` is preferred per YAGNI if the data never
changes based on props/state).

- [ ] **Step 5: Update the main view-model to import from the new file**

In `use-event-dashboard-shell-view-model.ts`, remove the extracted
`lucide-react` imports and inline config, replacing them with an import of
whatever `use-event-dashboard-nav.ts` exports, used exactly where the inline
config was used before.

- [ ] **Step 6: Update the barrel if the nav hook needs external visibility**

If any other file outside this feature needs the extracted export, add it to
`apps/event/src/features/event-dashboard/shell/index.ts`. If it's only used
by the main VM (expected case), no barrel change is needed.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm --workspace @prism/event run test -- event-dashboard-shell-architecture.test.ts`
Expected: PASS

Run: `npm --workspace @prism/event run typecheck`
Expected: no errors

- [ ] **Step 8: Manual smoke check**

Start `apps/event` dev server, confirm the sidebar nav renders identically
(same items, same icons, same order) to before this task.

- [ ] **Step 9: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/event --src auto --paths features/event-dashboard --fail-on error`
Expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add apps/event/src/features/event-dashboard/shell
git commit -m "refactor(event): extract static nav config out of the dashboard shell view-model"
```

---

### Task 13: Collapse literal filter folders into `[param]` segments (F4b)

**Files:**
- Move: `apps/event/src/app/(portal)/dashboard/clients/{active,archived,past,prospects}/page.tsx` → deleted, replaced by one `apps/event/src/app/(portal)/dashboard/clients/[clientListView]/page.tsx`
- Modify: `apps/event/src/features/event-dashboard/shell/model/event-dashboard-routing.ts` (only if the literal-folder route matching needs a name change — verify first, see Step 2)

**Interfaces:** unchanged public URLs — `/dashboard/clients/active`,
`/dashboard/clients/archived`, `/dashboard/clients/past`,
`/dashboard/clients/prospects` must all continue to resolve exactly as
before. Only the filesystem shape collapses from 4 duplicate shim files to 1
parameterized shim.

**Scope for this task:** do **one filter family** (the `event` app's
`clients/{active,archived,past,prospects}` — chosen because
`CLIENT_LIST_ROUTE_ITEMS` in `event-dashboard-routing.ts` already defines
this exact closed set) as the proof of the pattern. The `client` app's
`events/{upcoming,cancelled,completed,draft-requests,in-planning}` family and
the `event` app's `events/{cancelled,completed,draft,ongoing,upcoming}`
family follow the identical pattern as tracked follow-up work — do not batch
them into this task.

- [ ] **Step 1: Confirm all 4 pages are identical shims**

Run:
```powershell
Get-Content "apps/event/src/app/(portal)/dashboard/clients/active/page.tsx","apps/event/src/app/(portal)/dashboard/clients/archived/page.tsx","apps/event/src/app/(portal)/dashboard/clients/past/page.tsx","apps/event/src/app/(portal)/dashboard/clients/prospects/page.tsx"
```
Expected: each is `<EventDashboardRouteView routeKey="clients/<name>" />`
with only `<name>` differing — confirms they collapse safely.

- [ ] **Step 2: Confirm `routeStateFromPath` already treats these as one
parameterized family**

Re-read `event-dashboard-routing.ts`'s `routeStateFromPath` function (lines
382-384 as read during the review):
```ts
  if (parts[1] === "clients") {
    if (!parts[2]) return { section: "clients", tab: "overview", view: "all" };
    if (CLIENT_LIST_ROUTE_ITEMS[parts[2]]) return { section: "clients", tab: "overview", view: parts[2] };
```
This already reads `parts[2]` as a generic segment value, not a hardcoded
literal per folder — confirming no change is needed here. The routing logic
was already parameterized; only the filesystem had 4 duplicate folders.

- [ ] **Step 3: Create the single parameterized route file**

```bash
mkdir -p "apps/event/src/app/(portal)/dashboard/clients/[clientListView]"
```

Create `apps/event/src/app/(portal)/dashboard/clients/[clientListView]/page.tsx`:
```tsx
import { EventDashboardRouteView } from "@/features/event-dashboard/shell";

export default function EventDashboardRoutePage() {
  return <EventDashboardRouteView routeKey="clients/[clientListView]" />;
}
```

(The `routeKey` prop is unused by `EventDashboardRouteView` today — it
`return null` unconditionally, per the review. Keep passing a descriptive
string anyway, matching the convention of every other shim page, so this
file is not a silent outlier if `routeKey` is ever wired up.)

- [ ] **Step 4: Delete the 4 literal folders**

```bash
git rm -r "apps/event/src/app/(portal)/dashboard/clients/active" "apps/event/src/app/(portal)/dashboard/clients/archived" "apps/event/src/app/(portal)/dashboard/clients/past" "apps/event/src/app/(portal)/dashboard/clients/prospects"
git add "apps/event/src/app/(portal)/dashboard/clients/[clientListView]/page.tsx"
```

- [ ] **Step 5: Build and verify all 4 URLs still resolve**

Run: `npm --workspace @prism/event run build`
Expected: succeeds. Start dev server, visit each of `/dashboard/clients/active`,
`/dashboard/clients/archived`, `/dashboard/clients/past`,
`/dashboard/clients/prospects` — confirm each renders the exact same client
list filtered the exact same way as before this task (this is driven by
`routeStateFromPath` parsing the URL segment directly, which Step 2 already
confirmed needs no change).

- [ ] **Step 6: Confirm an invalid segment still 404s correctly**

Visit `/dashboard/clients/not-a-real-filter` — confirm behavior is unchanged
from before this task (per `routeStateFromPath`, an unrecognized `parts[2]`
falls through to the `clientId` branch, which is pre-existing behavior this
task does not change — just confirm it, don't fix it if it looks odd; that
would be scope creep).

- [ ] **Step 7: Run existing routing tests**

Run: `npm --workspace @prism/event run test -- event-dashboard-routing`
Expected: PASS unchanged (this task did not touch `event-dashboard-routing.ts`)

- [ ] **Step 8: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/event --src auto --fail-on error`
Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(event): collapse clients/{active,archived,past,prospects} into [clientListView]"
```

**Note for follow-up work (out of scope for this plan):** repeat this exact
pattern for `apps/client`'s `events/{upcoming,cancelled,completed,draft-requests,in-planning}`
and `apps/event`'s `events/{cancelled,completed,draft,ongoing,upcoming}`
families, one family per PR, using this task as the template.

**Correction (2026-09-01, during execution):** Step 3 as originally written
(create a new `[clientListView]` dynamic segment alongside the existing
`[clientId]` segment) is not possible — Next.js App Router rejects two
differently-named dynamic segments at the same path depth
("Ambiguous app routes detected"). The actual fix: since
`clients/[clientId]/page.tsx` was already a `return null` shim identical in
shape to the 4 literal folders, and `routeStateFromPath` already treats an
unrecognized `parts[2]` value as falling through to the `clientId` branch
(exactly as anticipated in this task's own Step 6), the 4 literal folders
were simply deleted with no replacement folder needed — the existing
`[clientId]` catch-all now serves those routes. Verified: build succeeds,
all 4 URLs preserved (now server-rendered on demand instead of statically
prerendered, with identical VM-driven output), 48/48 tests still pass,
`event-dashboard-routing.ts` untouched.

---

### Task 14: Real per-section page for `audit` in the event app (F4c)

**Files:**
- Modify: `apps/event/src/app/(portal)/dashboard/audit/page.tsx`
- Modify: `apps/event/src/features/event-dashboard/shell/views/event-dashboard-shell-view.tsx` (remove the audit-section branch only)
- No change: every other section's `page.tsx` (still `return null` shims —
  out of scope for this task, tracked as follow-up)

**Interfaces:**
- Consumes: `apps/event/src/features/audit/trail`'s existing
  `AuditTrailPanel` view (already exists per the module inventory — verify
  its exact export name before wiring it in).
- Produces: nothing new — `audit/page.tsx`'s default export signature is
  unchanged (still a route page component with no props).

**Scope for this task:** do **one section only** (`audit` — the same one
scoped by Task 11's layout seam), proving the full F4c pattern end-to-end
(real page, scoped layout, shell no longer branches on this section). This
is deliberately the smallest possible slice; the remaining 11 sections are
explicitly out of scope and tracked as follow-up, one section per PR, per
the priority/risk matrix's guidance to never batch this change.

**Prerequisite:** Task 8 (F1), Task 11 (F6 seam for `audit`), and Task 12
(F3) must be complete before starting this task.

- [ ] **Step 1: Find the audit trail feature's exported view**

Run:
```powershell
Get-Content "apps/event/src/features/audit/trail/index.ts"
```
Confirm the exact exported view component name (expected:
`AuditTrailPanel` per the module inventory from the review — verify, do not
assume).

- [ ] **Step 2: Find exactly how the shell currently renders the audit
section**

Re-run the Step 2 search from Task 11 if not already open:
```powershell
Select-String -Path "apps/event/src/features/event-dashboard/shell/views/event-dashboard-shell-view.tsx" -Pattern "audit" -Context 5,5
```
Identify the exact conditional block that renders the audit panel when
`section === "audit"` (or equivalent), and what data/props it currently
passes to it.

- [ ] **Step 3: Write the real `page.tsx`**

Replace `apps/event/src/app/(portal)/dashboard/audit/page.tsx` (currently
`<EventDashboardRouteView routeKey="audit" />`) with the one-line barrel
convention from F5:

```tsx
export { AuditTrailPanel as default } from "@/features/audit/trail";
```

(If `AuditTrailPanel` requires props that were previously supplied by the
shell VM — check Step 2's findings — those props must now come from the
page itself, e.g. via the feature's own data-fetching in its ViewModel,
not via prop-drilling from the shell. If `AuditTrailPanel` is not already
self-sufficient, this step additionally requires updating
`use-audit-trail-view-model.ts` to fetch what it needs directly — this is
expected per `feature-composition.md`'s "each feature view is self-contained
with its own ViewModel" rule, and is exactly the point of this refactor.)

- [ ] **Step 4: Remove the section's rendering branch from the shell**

In `event-dashboard-shell-view.tsx`, remove the conditional block identified
in Step 2 that rendered the audit panel — the layout from Task 11 plus the
new `page.tsx` from Step 3 now own that rendering instead.

- [ ] **Step 5: Build and verify `/dashboard/audit` renders identically**

Run: `npm --workspace @prism/event run build`
Expected: succeeds. Start dev server, visit `/dashboard/audit`, compare
pixel-for-pixel against the Task 11 Step 1 baseline. This is the critical
verification for this entire task — any visual or data difference is a
regression and must be fixed before continuing.

- [ ] **Step 6: Confirm every other section is completely unaffected**

Visit at minimum `/dashboard`, `/dashboard/events`, `/dashboard/calendar`,
`/dashboard/command-inbox` — confirm all render exactly as before this task
(they still flow through the unchanged shim-and-VM path).

- [ ] **Step 7: Run the full event app test suite**

Run: `npm --workspace @prism/event run test`
Expected: PASS — same or higher pass count than before this task (any test
specifically asserting the old shell-branch behavior for `audit` should be
updated to assert against the new page instead, not deleted silently)

- [ ] **Step 8: Boundary check**

Run: `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/event --src auto --paths features/event-dashboard,features/audit --fail-on error`
Expected: 0 errors

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(event): render the audit dashboard section from a real page, not the shell VM"
```

**Note for follow-up work (out of scope for this plan):** repeat Steps 1-9
for each remaining section (`calendar`, `clients`, `command-inbox`,
`events`, `files`, `finance`, `inquiries`, `messages`, `settings`,
`suppliers`, `tasks`, `team`), each requiring its own Task-11-equivalent
layout seam first if not already scoped, one section per PR, verifying after
each before starting the next. Only after every section is migrated does the
941-line VM's `routeStateFromPath`-driven rendering fully retire (the 416-
line `event-dashboard-routing.ts` route-map file may still be useful for nav
highlighting even after this migration — do not delete it as part of this
work unless a later review confirms it is fully redundant).

---

### Task 15: Add a thin `domain/` layer to `supplier-ops` (B1b)

**Files:**
- Create: `apps/api/libs/modules/supplier-ops/src/domain/supplier-quote-request.policy.ts`
- Create: `apps/api/libs/modules/supplier-ops/src/domain/supplier-quote-request.policy.test.ts`
- Modify: `apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts`
- Modify: `apps/api/libs/modules/supplier-ops/src/index.ts`

**Interfaces:**
- Produces: `canTransitionSupplierQuoteRequestStatus(from: SupplierQuoteRequestStatusValue, to: SupplierQuoteRequestStatusValue): boolean`
- Consumes (in the service): the existing `SupplierQuoteRequestStatus` from
  `@prism/modules/event-core` (unchanged import), plus the new policy
  function above.

**Prerequisite:** Task 9 (B1, the `live-ops` domain layer) must be complete
first — this task follows the exact same extraction pattern, applied to
`supplier-ops`'s largest state machine (`SupplierQuoteRequestStatus`:
`open → submitted → revision_requested → revised → selected/closed/expired`).

- [ ] **Step 1: Find every current status-transition check in
`supplier-network-workflow.service.ts`**

Run:
```powershell
Select-String -Path "apps/api/libs/modules/supplier-ops/src/services/supplier-network-workflow.service.ts" -Pattern "SupplierQuoteRequestStatus\." -Context 2,2
```
Read every match to build the exact list of currently-allowed transitions
before writing the policy — do not invent transitions not already enforced
by the existing code; this task extracts existing rules, it does not add
new ones.

- [ ] **Step 2: Write the failing test for the extracted policy**

Create `apps/api/libs/modules/supplier-ops/src/domain/supplier-quote-request.policy.test.ts`
with one `it` per transition found in Step 1 confirming it is allowed, and
at least 2 `it`s confirming clearly-invalid transitions are rejected (e.g.
`selected` → `open`, `closed` → `submitted`) — write the exact test cases
once Step 1's transition list is known; do not guess the transition table
in advance of reading the real service code.

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm --workspace prism-api run test -- domain/supplier-quote-request.policy.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the policy module**

Create `apps/api/libs/modules/supplier-ops/src/domain/supplier-quote-request.policy.ts`
with a `canTransitionSupplierQuoteRequestStatus` function whose transition
table exactly matches what Step 1 found — implement as a
`Record<Status, Status[]>` adjacency map, framework-independent (no NestJS,
no Prisma imports), matching the shape of Task 9's
`live-ops-escalation.policy.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm --workspace prism-api run test -- domain/supplier-quote-request.policy.test.ts`
Expected: PASS

- [ ] **Step 6: Wire the policy into the service**

Replace whatever inline transition checks Step 1 found in
`supplier-network-workflow.service.ts` with calls to
`canTransitionSupplierQuoteRequestStatus`, preserving the exact same
`BadRequestException`/error message behavior on an invalid transition (same
try/catch translation pattern as Task 9, Step 5.4, if the policy throws
rather than returning a boolean — choose whichever the Step 1 findings show
the existing code already does, to keep behavior identical).

- [ ] **Step 7: Export from the feature index**

Add `export * from './domain/supplier-quote-request.policy';` to
`apps/api/libs/modules/supplier-ops/src/index.ts`.

- [ ] **Step 8: Run the full supplier-ops test suite**

Run: `npm --workspace prism-api run test -- libs/modules/supplier-ops`
Expected: PASS — same pass count as before this task, plus the new domain
tests

- [ ] **Step 9: Typecheck and boundary check**

Run: `npm run typecheck` — expected: no errors
Run: `node ~/.agents/skills/backend-architecture/scripts/check-boundaries.mjs apps/api --paths libs/modules/supplier-ops --fail-on error` — expected: 0 errors

- [ ] **Step 10: Commit**

```bash
git add apps/api/libs/modules/supplier-ops
git commit -m "refactor(supplier-ops): extract quote-request status transitions into domain/"
```

---

### Task 16: Document owned/read-only Prisma tables per module (B2)

**Files:**
- Modify: every `*.module.ts` file under `apps/api/libs/modules/*/src/` (24
  files after Task 10's merge reduces the count to ~21 — confirm the exact
  current list with `Get-ChildItem apps/api/libs/modules -Recurse -Filter "*.module.ts"`
  before starting)

**Interfaces:** none — this is documentation-only, no behavior or type
change in any file.

- [ ] **Step 1: For each module, identify its owned Prisma models**

For each `<module>.module.ts` file, grep that module's `src/` for every
`this.prisma.<modelName>` call:
```powershell
Select-String -Path "apps/api/libs/modules/<module>/src/**/*.ts" -Pattern "prisma\.(\w+)\." -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
```
Classify each model as **owned** (this module writes to it) or **read-only**
(this module only reads it, another module owns the writes — cross-check
against `event-read-models`' existing readers for the established pattern).

- [ ] **Step 2: Add a doc comment above each module's `@Module` decorator**

For each module, add a comment block immediately above `@Module({...})` in
this exact format (fill in the real values from Step 1 for that module —
do not copy this example's placeholder values):

```ts
/**
 * Owned tables: OpsUrgentIssue, OpsEventDayTask, OpsEventDayLog.
 * Read-only: OpsEvent (via event-core), OpsSupplierQuoteRequest (via supplier-ops).
 */
@Module({
  ...
})
export class ExampleModule {}
```

Do this for every module file identified in Step 1's list. This is
mechanical and can be done in any order; batch by module for reviewability
(e.g. one commit per 4-6 modules) rather than one enormous commit.

- [ ] **Step 2 (repeat, batch 1 of N): first batch of modules**

Cover `access-control`, `ai-governance`, `closure-ops`, `commercial-ops`,
`compliance-ops`, `event-core` in this batch.

Run: `npm run typecheck` after each batch — expected: no errors (comments
cannot break typecheck, but this confirms no accidental syntax error)

Commit:
```bash
git add apps/api/libs/modules/{access-control,ai-governance,closure-ops,commercial-ops,compliance-ops,event-core}
git commit -m "docs(api): document owned/read-only tables for batch 1 modules"
```

- [ ] **Step 2 (repeat, batch 2 of N): second batch**

Cover `event-read-models`, `event-session`, `file-ops`, `finance-ops`,
`floorplan`, `floorplan-authoring` (post-Task-10 name).

Commit:
```bash
git add apps/api/libs/modules/{event-read-models,event-session,file-ops,finance-ops,floorplan,floorplan-authoring}
git commit -m "docs(api): document owned/read-only tables for batch 2 modules"
```

- [ ] **Step 2 (repeat, batch 3 of N): third batch**

Cover `guest-ops`, `health`, `identity-ops`, `inquiry-onboarding`,
`live-ops`, `notification-ops`.

Commit:
```bash
git add apps/api/libs/modules/{guest-ops,health,identity-ops,inquiry-onboarding,live-ops,notification-ops}
git commit -m "docs(api): document owned/read-only tables for batch 3 modules"
```

- [ ] **Step 2 (repeat, batch 4 of N): final batch**

Cover `sample-compatibility`, `staffing-ops`, `supplier-ops`, `trust-ops`
(the remaining modules after Task 10's merge; re-verify this list is
complete against Step 1's file enumeration before considering this task
done).

Commit:
```bash
git add apps/api/libs/modules/{sample-compatibility,staffing-ops,supplier-ops,trust-ops}
git commit -m "docs(api): document owned/read-only tables for batch 4 modules"
```

- [ ] **Step 3: Final verification**

Run: `Get-ChildItem apps/api/libs/modules -Recurse -Filter "*.module.ts" | Select-String -Pattern "Owned tables:" -List | Measure-Object`
Expected count matches the total module count from Step 1's enumeration —
confirms every module got documented, none skipped.

---

## Final verification (after all 16 tasks)

- [ ] Run `npm run build && npm run typecheck` at the workspace root —
  expected: succeeds for every workspace.
- [ ] Run `npm run test:api` — expected: PASS, pass count ≥ pre-plan baseline.
- [ ] Run `node ~/.agents/skills/backend-architecture/scripts/check-boundaries.mjs apps/api --fail-on error`
  — expected: 0 errors.
- [ ] Run `node ~/.agents/skills/next-feature-architecture/scripts/check-boundaries.mjs --cwd apps/client --src auto --fail-on error`
  (repeat for `apps/event`, `apps/guest`, `apps/supplier`) — expected: 0
  errors for all 4.
- [ ] Run `npm run prisma:validate` (via `apps/api`) — expected: succeeds (no
  schema drift introduced by this plan).
- [ ] Manually click through every portal's root path, sign-in, and one
  representative dashboard page — confirm no URL changed from the plan's
  start (spot-check against the Task 4-7 snapshots).
- [ ] Re-run the alignment review's detectors
  (`detect.mjs`/`detect-backend.mjs`) one more time and confirm the FE
  boundary-checker findings (F1) and BE controller findings (B4) reported at
  the top of `docs/reviews/2026-09-01-fe-be-architecture-alignment.md` no
  longer reproduce.
