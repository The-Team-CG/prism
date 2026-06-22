# Prism EventOps Target Shape Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In side conversations, do not use subagents.

**Goal:** Remove the legacy `event-ops` module entirely by moving `/sample/*` into `sample-compatibility`, moving or deleting every old compatibility file, removing every `event-ops` alias/config entry, and leaving capability-owned modules as the only backend ownership shape.

**Architecture:** Keep one NestJS API and one Prisma client. First audit every capability module against the target folder contract, then create a dedicated `sample-compatibility` module for demo/seed/reset routes. Remove old `event-ops` controllers, DTOs, service re-exports, tests, aliases, and module registration in dependency order after import checks prove each piece is unused. Capability modules keep ownership of their own controllers, DTOs, mappers, ports, services, and tests; `event-read-models` uniquely owns `queries`. The final target is zero tracked files under `apps/api/libs/modules/event-ops` and zero active app/package/script imports of `@prism/modules/event-ops` or `event-ops/src`.

**Tech Stack:** NestJS modules/providers/controllers, Prisma, Vitest, TypeScript path aliases, `scripts/check-prism-boundaries.mjs`, existing Prism API package scripts.

---

## Implementation Status

Implemented in `backend-modular-monolith-plan`:

- `/sample/state`, `/sample/reset`, and `/sample/seed` now live in `apps/api/libs/modules/sample-compatibility`.
- `apps/api/apps/api/src/app.module.ts` imports `SampleCompatibilityModule` instead of `EventOpsModule`.
- `apps/api/libs/modules/event-ops` is deleted from the backend module tree.
- API TypeScript, Vitest, Nest CLI, and package scripts no longer expose `@prism/modules/event-ops` or an event-ops library target.
- Boundary checks fail any tracked file under `apps/api/libs/modules/event-ops` and allow sample aggregation only under `sample-compatibility`.

## Pre-Implementation State Summary

`apps/api/libs/modules/event-ops` is still large because it contains the old backend hub shape plus compatibility files:

- Active compatibility: `src/controllers/sample.controller.ts`, `src/event-ops.service.ts`, `src/services/sample-state.service.ts`, `src/event-ops.module.ts`.
- Legacy compatibility exports: many files under `src/services` re-export services now owned by capability modules.
- Legacy DTO surface: `src/dto/event-ops.dto.ts` and `src/event-ops.dto.test.ts`.
- Legacy tests: `src/event-ops.service.test.ts` still directly constructs `EventOpsService` for broad sample and workflow regression coverage.
- Config still exposes `@prism/modules/event-ops` through `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`, and `apps/api/nest-cli.json`.

Target end state:

```txt
apps/api/libs/modules/sample-compatibility/
  src/
    controllers/
      sample.controller.ts
      controller-routes.test.ts
      index.ts
    services/
      sample-compatibility.service.ts
      sample-compatibility.service.test.ts
      sample-state.service.ts
      sample-state.service.test.ts
    sample-compatibility.module.ts
    index.ts
  tsconfig.lib.json
```

and no `apps/api/libs/modules/event-ops` module after every import is removed.

## EventOps Removal Strategy

Execute the removal in dependency order. Do not delete the `event-ops` folder first; delete it only after the sample routes, compatibility tests, aliases, and boundary rules no longer need it.

1. **Baseline:** capture current imports, sample route behavior, API build, and boundary status before moving files.
2. **Normalize ownership:** move any remaining DTOs, mappers, ports, and tests to the capability module that owns the route or workflow.
3. **Create `sample-compatibility`:** add the library shell, controller registry, sample service, sample state service, config aliases, and Nest project entry.
4. **Move `/sample/*`:** move `SampleController`, `SampleStateService`, sample orchestration, and sample-specific tests into `sample-compatibility` while preserving route paths.
5. **Switch runtime wiring:** replace `EventOpsModule` with `SampleCompatibilityModule` in `AppModule`; use an inert `EventOpsModule` only as a temporary checkpoint if needed.
6. **Delete compatibility shims:** remove old `event-ops` service/controller/DTO/port/test files only after import checks prove the owning modules or sample compatibility module cover them.
7. **Remove aliases and config:** delete `event-ops` path aliases, Vitest alias, Nest CLI project entry, and package scripts that point to event-ops.
8. **Delete the folder:** run `git rm -r apps/api/libs/modules/event-ops` after app/package/script imports are gone.
9. **Lock the boundary:** update the boundary checker so any future tracked file under `apps/api/libs/modules/event-ops` fails.

Final success means this command returns no app/package/script matches:

```powershell
rg -n "@prism/modules/event-ops|event-ops/src|EventOpsModule|EventOpsService|EVENT_OPS_CONTROLLERS" apps packages scripts -S
```

## Whole Backend Target Shape

The plan covers the full module tree, not only the leftover `event-ops` folder. The implementation target is:

```txt
apps/api/libs/modules/
  event-core/
    controllers/
    dto/
    services/
    ports/
    mappers/

  inquiry-onboarding/
    controllers/
    dto/
    services/
    ports/
    mappers/

  supplier-ops/
    controllers/
    dto/
    services/
    ports/
    mappers/

  finance-ops/
    controllers/
    dto/
    services/
    ports/
    mappers/

  staffing-ops/
    controllers/
    dto/
    services/
    ports/
    mappers/

  floorplan/
    controllers/
    dto/
    services/
    ports/
    mappers/

  file-ops/
    controllers/
    dto/
    services/
    ports/
    mappers/

  live-ops/
    controllers/
    dto/
    services/
    ports/
    mappers/

  event-read-models/
    controllers/
    dto/
    services/
    queries/
    mappers/

  sample-compatibility/
    controllers/
    dto/
    services/

```

Folder presence is not enough by itself. Each folder must contain only files owned by that capability, and any empty folder should include a short `.gitkeep` only if the repository needs to preserve the shape before the first file lands. Do not create empty architecture folders just for symmetry if the capability has no planned code in that layer.

## File Responsibility Map

- `apps/api/libs/modules/<capability>/controllers`: route controllers owned by that capability. Controllers should call local services or public provider ports, not `EventOpsService`.
- `apps/api/libs/modules/<capability>/dto`: request/response DTOs for that module's controllers. Shared public contract types still belong in `packages/types` when reused by clients.
- `apps/api/libs/modules/<capability>/services`: write workflows, local policies, orchestration, and adapters owned by the capability.
- `apps/api/libs/modules/<capability>/ports`: explicit provider tokens and interfaces used for cross-module access.
- `apps/api/libs/modules/<capability>/mappers`: conversion between Prisma/domain records and route/API payload shapes.
- `apps/api/libs/modules/event-read-models/src/queries`: approved read-only query builders with query-budget comments.
- `apps/api/libs/modules/sample-compatibility/src/sample-compatibility.module.ts`: imports every capability module needed to assemble `/sample/*` state, reset, and seed behavior.
- `apps/api/libs/modules/sample-compatibility/src/controllers/sample.controller.ts`: owns `GET /api/sample/state`, `POST /api/sample/reset`, and `POST /api/sample/seed`.
- `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts`: replaces the remaining sample-facing methods from `EventOpsService` and contains only sample aggregation, seed, reset, and mapping helpers.
- `apps/api/libs/modules/sample-compatibility/src/services/sample-state.service.ts`: keeps bounded Prisma sample read aggregation and rejects sample access when sample compatibility is disabled.
- `apps/api/apps/api/src/app.module.ts`: imports `SampleCompatibilityModule` instead of `EventOpsModule`.
- `apps/api/tsconfig.json`: adds `@prism/modules/sample-compatibility` path aliases, then removes every `@prism/modules/event-ops` alias after the alias is no longer used.
- `apps/api/vitest.config.ts`: adds the test alias for `sample-compatibility`, then removes the `event-ops` alias after the alias is no longer used.
- `apps/api/nest-cli.json`: adds the `sample-compatibility` library project, then removes the `event-ops` project after the module is no longer imported or built.
- `scripts/check-prism-boundaries.mjs`: changes guardrails from allowing a fixed legacy event-ops service list to failing any tracked source file under `apps/api/libs/modules/event-ops`.
- `scripts/check-prism-boundaries.test.mjs`: proves any event-ops file fails and sample-compatibility files pass.
- `packages/api-client/src/event-ops-client.ts`: keeps public `/sample/*` API-client behavior stable in the first slice; optional later rename to `sample-compatibility-client.ts` requires package export compatibility.
- `docs/prism-v4/15-system-architecture.md`, `docs/prism-v4/17-current-state-2026-06-20.md`, and this plan: document final module shape and current migration status.

## Task 1: Establish Import And Behavior Baseline

**Files:**
- Read: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
- Read: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`
- Read: `apps/api/libs/modules/event-ops/src/controllers/sample.controller.ts`
- Read: `apps/api/libs/modules/event-ops/src/services/sample-state.service.ts`
- Read: `scripts/check-prism-boundaries.mjs`

- [ ] **Step 1: Capture current event-ops import inventory**

Run:

```powershell
rg -n "@prism/modules/event-ops|event-ops/src|EventOpsService|EventOpsModule|SampleController|SampleStateService" apps packages scripts docs -S
```

Expected: imports still exist in `apps/api/apps/api/src/app.module.ts`, event-ops tests, controller, module, API config aliases, boundary tests, and docs. Save the output in the implementation notes for this task.

- [ ] **Step 2: Capture current sample route behavior tests**

Run:

```powershell
npm --workspace prism-api run test -- controller-routes.test.ts event-ops.service.test.ts event-ops.dto.test.ts
```

Expected: tests pass or fail only with the known local `spawn EPERM` sandbox issue. If `spawn EPERM` occurs, rerun the exact same command with approved elevated execution.

- [ ] **Step 3: Capture current build and boundary status**

Run:

```powershell
npm --workspace prism-api run build
npm run check:boundaries
git diff --check
```

Expected: API build passes, boundary check passes, and `git diff --check` reports no whitespace errors. If build or boundary fails only because of sandbox `EPERM`, rerun the exact same command with approved elevated execution.

## Task 2: Audit And Normalize Capability Module Shape

**Files:**
- Read: `apps/api/libs/modules/event-core`
- Read: `apps/api/libs/modules/inquiry-onboarding`
- Read: `apps/api/libs/modules/supplier-ops`
- Read: `apps/api/libs/modules/finance-ops`
- Read: `apps/api/libs/modules/staffing-ops`
- Read: `apps/api/libs/modules/floorplan`
- Read: `apps/api/libs/modules/file-ops`
- Read: `apps/api/libs/modules/live-ops`
- Read: `apps/api/libs/modules/event-read-models`
- Read: `apps/api/libs/modules/event-ops`
- Modify after audit: only module folders with misplaced files or missing ownership docs

- [ ] **Step 1: Generate the current module folder inventory**

Run:

```powershell
$modules = @('event-core','inquiry-onboarding','supplier-ops','finance-ops','staffing-ops','floorplan','file-ops','live-ops','event-read-models','event-ops')
foreach ($module in $modules) {
  Write-Output "## $module"
  Get-ChildItem -Path "apps/api/libs/modules/$module/src" -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
}
```

Expected: the output shows which target folders already exist and which are missing. Record the result in the implementation notes before moving files.

- [ ] **Step 2: Generate misplaced-file candidates**

Run:

```powershell
rg -n "from ['\"](\.\./)+event-ops|from ['\"]@prism/modules/event-ops|event-ops/src" apps/api/libs/modules packages scripts -S
rg -n "class .*Controller|@Controller\(" apps/api/libs/modules/event-ops/src apps/api/libs/modules/*/src -S
rg -n "export class .*Dto|export type .*Dto|interface .*Dto" apps/api/libs/modules/event-ops/src apps/api/libs/modules/*/src -S
```

Expected: any active controller, DTO, mapper, service, or port still under `event-ops` is classified before deletion or movement. Do not move files based only on filename; ownership must match the route/workflow in the current module docs.

- [ ] **Step 3: Create missing target folders only when a file will move into them**

For each capability, create only the folders needed by actual files in that slice. Example for a supplier DTO move:

```powershell
New-Item -ItemType Directory -Force apps/api/libs/modules/supplier-ops/src/dto
```

Expected: no empty architecture folders are added unless a `.gitkeep` is intentionally required and documented.

- [ ] **Step 4: Move DTOs to owning modules**

For every DTO still exported from `apps/api/libs/modules/event-ops/src/dto/event-ops.dto.ts`, classify it by route owner:

```txt
inquiry/conforme/onboarding DTO -> inquiry-onboarding/src/dto
supplier profile, assignment, PARE route DTO -> supplier-ops/src/dto
finance billing/payment DTO -> finance-ops/src/dto
staffing/coordinator DTO -> staffing-ops/src/dto
floorplan DTO -> floorplan/src/dto
file requirement/upload DTO -> file-ops/src/dto
live operations DTO -> live-ops/src/dto
dashboard/workspace/defense-readiness DTO -> event-read-models/src/dto
sample-only DTO -> sample-compatibility/src/dto
```

After each move, update imports in the owning controller/service and run the narrow test for that module.

- [ ] **Step 5: Move mappers to owning modules**

For each mapper still embedded in `EventOpsService` or old event-ops services, move it to the owner module's `mappers` folder. Keep read-model mappers in `event-read-models/src/mappers`; keep sample-only wrapper mappers in `sample-compatibility/src/services` unless they are reusable by a real capability.

Run after each mapper move:

```powershell
npm --workspace prism-api run test -- <owning-module-test-file>
```

Expected: moved mappers preserve response shape exactly.

- [ ] **Step 6: Move ports to owning modules**

For provider tokens still under `apps/api/libs/modules/event-ops/src/ports`, move them to the module that owns the provider:

```txt
access-control tokens -> access-control/src/ports
trust/audit/privacy tokens -> trust-ops/src/ports
notification outbox tokens -> notification-ops/src/ports
event lifecycle/command tokens -> event-core/src/ports
```

Run:

```powershell
rg -n "event-ops/src/ports|@prism/modules/event-ops/.*/ports" apps packages scripts -S
npm --workspace prism-api run build
```

Expected: no active imports reference event-ops ports after the moves.

- [ ] **Step 7: Add or update per-module barrel exports**

Each capability module `src/index.ts` should export only its public Nest module and intentional public ports/types. Do not export private services just because tests can import them by alias. Use relative imports inside same-module tests where needed.

Run:

```powershell
rg -n "export \* from './services|export \* from './controllers|export \* from './dto" apps/api/libs/modules/*/src/index.ts -S
```

Expected: public barrels do not expose private implementation folders unless there is an explicit cross-module contract reason.

- [ ] **Step 8: Verify target shape before sample extraction starts**

Run:

```powershell
npm --workspace prism-api run build
npm run check:boundaries
git diff --check
```

Expected: build and boundary checks pass before starting the sample-compatibility move.
## Task 3: Add The SampleCompatibility Module Shell

**Files:**
- Create: `apps/api/libs/modules/sample-compatibility/tsconfig.lib.json`
- Create: `apps/api/libs/modules/sample-compatibility/src/index.ts`
- `apps/api/libs/modules/sample-compatibility/src/sample-compatibility.module.ts`: imports every capability module needed to assemble `/sample/*` state, reset, and seed behavior.
- Modify: `apps/api/tsconfig.json`
- Modify: `apps/api/vitest.config.ts`
- Modify: `apps/api/nest-cli.json`

- [ ] **Step 1: Create the library tsconfig**

Create `apps/api/libs/modules/sample-compatibility/tsconfig.lib.json`:

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "outDir": "../../../dist/libs/modules/sample-compatibility"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 2: Create the module index**

Create `apps/api/libs/modules/sample-compatibility/src/index.ts`:

```ts
export * from './sample-compatibility.module';
```

- [ ] **Step 3: Create the module shell**

- `apps/api/libs/modules/sample-compatibility/src/sample-compatibility.module.ts`: imports every capability module needed to assemble `/sample/*` state, reset, and seed behavior.

```ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';

@Module({
  imports: [DatabaseModule],
})
export class SampleCompatibilityModule {}
```

- [ ] **Step 4: Add TypeScript path aliases**

Modify `apps/api/tsconfig.json` under `compilerOptions.paths` and add both aliases:

```json
"@prism/modules/sample-compatibility": [
  "libs/modules/sample-compatibility/src/index"
],
"@prism/modules/sample-compatibility/*": [
  "libs/modules/sample-compatibility/src/*"
]
```

Keep the existing `event-ops` aliases for now. They are removed only after the final import check passes.

- [ ] **Step 5: Add Vitest alias**

Modify `apps/api/vitest.config.ts` inside `resolve.alias`:

```ts
  '@prism/modules/sample-compatibility': resolve(__dirname, './libs/modules/sample-compatibility/src/index.ts'),
```

- [ ] **Step 6: Add Nest CLI library project**

Modify `apps/api/nest-cli.json` under `projects`:

```json
"sample-compatibility": {
  "type": "library",
  "root": "libs/modules/sample-compatibility",
  "entryFile": "index",
  "sourceRoot": "libs/modules/sample-compatibility/src",
  "compilerOptions": {
    "tsConfigPath": "libs/modules/sample-compatibility/tsconfig.lib.json"
  }
}
```

- [ ] **Step 7: Verify the shell compiles**

Run:

```powershell
npm --workspace prism-api run build
```

Expected: build passes with the new empty module registered in config but not yet imported by `AppModule`.

## Task 4: Move Sample Controller And SampleStateService

**Files:**
- Move: `apps/api/libs/modules/event-ops/src/controllers/sample.controller.ts` to `apps/api/libs/modules/sample-compatibility/src/controllers/sample.controller.ts`
- Move: `apps/api/libs/modules/event-ops/src/controllers/controller-routes.test.ts` to `apps/api/libs/modules/sample-compatibility/src/controllers/controller-routes.test.ts`
- Create: `apps/api/libs/modules/sample-compatibility/src/controllers/index.ts`
- Move: `apps/api/libs/modules/event-ops/src/services/sample-state.service.ts` to `apps/api/libs/modules/sample-compatibility/src/services/sample-state.service.ts`

- [ ] **Step 1: Move the files without changing behavior**

Run:

```powershell
New-Item -ItemType Directory -Force apps/api/libs/modules/sample-compatibility/src/controllers
New-Item -ItemType Directory -Force apps/api/libs/modules/sample-compatibility/src/services
git mv apps/api/libs/modules/event-ops/src/controllers/sample.controller.ts apps/api/libs/modules/sample-compatibility/src/controllers/sample.controller.ts
git mv apps/api/libs/modules/event-ops/src/controllers/controller-routes.test.ts apps/api/libs/modules/sample-compatibility/src/controllers/controller-routes.test.ts
git mv apps/api/libs/modules/event-ops/src/services/sample-state.service.ts apps/api/libs/modules/sample-compatibility/src/services/sample-state.service.ts
```

- [ ] **Step 2: Create the sample controller registry**

Create `apps/api/libs/modules/sample-compatibility/src/controllers/index.ts`:

```ts
export { SampleController } from './sample.controller';

import { SampleController } from './sample.controller';

export const SAMPLE_COMPATIBILITY_CONTROLLERS = [SampleController];
```

- [ ] **Step 3: Update the controller dependency name**

In `apps/api/libs/modules/sample-compatibility/src/controllers/sample.controller.ts`, replace the old service import and constructor with:

```ts
import { SampleCompatibilityService } from '../services/sample-compatibility.service';

@Controller('sample')
export class SampleController {
  constructor(private readonly sampleCompatibilityService: SampleCompatibilityService) {}

  @Get('state')
  state() {
    return this.sampleCompatibilityService.state();
  }

  @Post('reset')
  @HttpCode(HttpStatus.OK)
  reset() {
    return this.sampleCompatibilityService.resetSample();
  }

  @Post('seed')
  @HttpCode(HttpStatus.OK)
  seed() {
    return this.sampleCompatibilityService.seedSampleState();
  }
}
```

Preserve the existing comment above `state()`.

- [ ] **Step 4: Update the route registry test**

In `apps/api/libs/modules/sample-compatibility/src/controllers/controller-routes.test.ts`, assert the new registry:

```ts
import { describe, expect, it } from 'vitest';
import { SampleController } from './sample.controller';
import { SAMPLE_COMPATIBILITY_CONTROLLERS } from './index';

describe('sample compatibility controller registry', () => {
  it('only registers sample compatibility routes', () => {
    expect(SAMPLE_COMPATIBILITY_CONTROLLERS).toEqual([SampleController]);
  });
});
```

- [ ] **Step 5: Run the moved controller test**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/sample-compatibility/src/controllers/controller-routes.test.ts
```

Expected: the registry test passes.

## Task 5: Extract SampleCompatibilityService From EventOpsService

**Files:**
- Create: `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts`
- Create: `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.test.ts`
- `apps/api/libs/modules/sample-compatibility/src/sample-compatibility.module.ts`: imports every capability module needed to assemble `/sample/*` state, reset, and seed behavior.
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`

- [ ] **Step 1: Write the failing service construction test**

Create `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.test.ts` with a focused construction and delegation test:

```ts
import { describe, expect, it, vi } from 'vitest';
import { SampleCompatibilityService } from './sample-compatibility.service';

describe('SampleCompatibilityService', () => {
  it('delegates sample state reads through SampleStateService', async () => {
    const sampleStateService = { state: vi.fn().mockResolvedValue({ ok: true }) };
    const service = new SampleCompatibilityService({ sampleStateService } as never);

    await expect(service.state()).resolves.toEqual({ ok: true });

    expect(sampleStateService.state).toHaveBeenCalledTimes(1);
  });
});
```

If the real constructor uses explicit Nest dependencies, keep this assertion but instantiate the service with those dependencies in the same order as the constructor.

- [ ] **Step 2: Create the sample service with only sample public methods**

Create `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts`. Move these public methods from `EventOpsService` without changing response shape:

```ts
@Injectable()
export class SampleCompatibilityService {
  async state() {
    return this.sampleStateService.state(this.sampleStateContext());
  }

  async resetSample() {
    await this.sampleStateService.reset();
    await this.ensureSeeded();
    return this.state();
  }

  async seedSampleState() {
    await this.ensureSeeded();
    return this.state();
  }
}
```

Also move the private helper methods that those three methods call, including `sampleStateContext`, `ensureSeeded`, mapper helpers, payment risk sweep, and sample-only wrappers around capability services. Do not move route methods that are already owned by capability controllers.

- [ ] **Step 3: Wire module imports and providers**

Replace `sample-compatibility.module.ts` with a module that imports the same capability modules currently imported by `EventOpsModule`, then registers:

```ts
controllers: SAMPLE_COMPATIBILITY_CONTROLLERS,
providers: [SampleStateService, SampleCompatibilityService],
```

The imports should include `DatabaseModule`, `EventCoreModule`, `TrustOpsModule`, `NotificationOpsModule`, `AccessControlModule`, `IdentityOpsModule`, `InquiryOnboardingModule`, `CommercialOpsModule`, `ComplianceOpsModule`, `FloorplanModule`, `FileOpsModule`, `FinanceOpsModule`, `GuestOpsModule`, `StaffingOpsModule`, `SupplierOpsModule`, `AiGovernanceModule`, `LiveOpsModule`, `ClosureOpsModule`, and `EventReadModelsModule`.

- [ ] **Step 4: Shrink EventOpsService**

After `SampleCompatibilityService` owns `state`, `resetSample`, and `seedSampleState`, remove those methods and their private-only helpers from `apps/api/libs/modules/event-ops/src/event-ops.service.ts` if no remaining test or import calls them.

Run this import check before each deletion:

```powershell
rg -n "\.state\(|resetSample|seedSampleState|sampleStateContext|runPaymentRiskSweep|mapPaymentMilestone|mapFloorPlanDraft" apps/api/libs/modules/event-ops apps/api/libs/modules/sample-compatibility packages scripts -S
```

Expected: references are only in `sample-compatibility` after the move.

- [ ] **Step 5: Move sample assertions out of event-ops tests**

For each sample-only assertion in `apps/api/libs/modules/event-ops/src/event-ops.service.test.ts`, move the assertion into `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.test.ts` using the new service. Keep behavior expectations identical.

- [ ] **Step 6: Run focused tests**

Run:

```powershell
npm --workspace prism-api run test -- libs/modules/sample-compatibility/src event-ops.service.test.ts controller-routes.test.ts
```

Expected: sample-compatibility tests pass, and event-ops tests no longer depend on sample-only methods.

## Task 6: Replace AppModule Wiring

**Files:**
- Modify: `apps/api/apps/api/src/app.module.ts`
- Modify: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
- Modify: `apps/api/libs/modules/event-ops/src/controllers/index.ts`

- [ ] **Step 1: Import the new module in AppModule**

In `apps/api/apps/api/src/app.module.ts`, replace:

```ts
import { EventOpsModule } from '@prism/modules/event-ops';
```

with:

```ts
import { SampleCompatibilityModule } from '@prism/modules/sample-compatibility';
```

Replace `EventOpsModule` in the imports array with `SampleCompatibilityModule`.

- [ ] **Step 2: Make EventOpsModule inert if it still exists**

As a temporary checkpoint only, if `EventOpsModule` still exists after Task 4, make it inert:

```ts
import { Module } from '@nestjs/common';

@Module({})
export class EventOpsModule {}
```

Do this only after import checks show no runtime provider depends on `EventOpsModule`. This is not an acceptable final state; Task 9 deletes the module folder entirely.

- [ ] **Step 3: Build and boot-check AppModule**

Run:

```powershell
npm --workspace prism-api run build
$env:NODE_ENV='production'
$env:PRISM_DISABLE_CONFORME_REMINDER_JOB='1'
$env:PRISMA_DATABASE_URL='postgresql://user:pass@localhost:5432/prism_probe'
node -e "require('reflect-metadata'); const { NestFactory } = require('@nestjs/core'); const mod = require('./apps/api/dist/apps/api/apps/api/src/app.module.js'); NestFactory.createApplicationContext(mod.AppModule, { logger: false }).then(app => app.close()).then(() => console.log('AppModule context boot passed')).catch(error => { console.error(error && error.stack ? error.stack : error); process.exit(1); });"
```

Expected: build passes and the boot probe prints `AppModule context boot passed`.

## Task 7: Delete Legacy EventOps Compatibility Exports In Waves

**Files:**
- Delete when unused: `apps/api/libs/modules/event-ops/src/services/*.ts`
- Delete when unused: `apps/api/libs/modules/event-ops/src/controllers/*`
- Delete when unused: `apps/api/libs/modules/event-ops/src/dto/event-ops.dto.ts`
- Delete when unused: `apps/api/libs/modules/event-ops/src/event-ops.service.ts`
- Delete when unused: `apps/api/libs/modules/event-ops/src/event-ops.module.ts`
- Delete when unused: `apps/api/libs/modules/event-ops/src/index.ts`

- [ ] **Step 1: Classify every remaining event-ops file**

Run:

```powershell
Get-ChildItem -Path apps/api/libs/modules/event-ops/src -Recurse -File | Select-Object -ExpandProperty FullName
```

Classify each file as `moved to owning module`, `moved to sample-compatibility`, `compatibility re-export still imported`, `test to move`, or `delete now`.

- [ ] **Step 2: Verify old service re-exports have owning equivalents**

Run:

```powershell
rg -n "export \* from|export \{.*\} from|class .*Service" apps/api/libs/modules/event-ops/src/services apps/api/libs/modules -S
```

Expected: each old service under `event-ops/src/services` maps to an owning module service such as `trust-ops`, `finance-ops`, `supplier-ops`, `inquiry-onboarding`, `live-ops`, `event-read-models`, or `sample-compatibility`.

- [ ] **Step 3: Remove one compatibility file at a time**

For each candidate file, run:

```powershell
rg -n "event-ops/src/services/<file-name-without-extension>|@prism/modules/event-ops/src/services/<file-name-without-extension>|\.\/services\/<file-name-without-extension>" apps packages scripts -S
```

Expected before deletion: no active imports outside the file itself. Delete only files with zero active imports.

- [ ] **Step 4: Move tests to owning modules before deleting old tests**

Move known tests to their final owners:

```txt
apps/api/libs/modules/event-ops/src/services/ai-governance.service.test.ts -> apps/api/libs/modules/ai-governance/src/services/ai-governance.service.test.ts
apps/api/libs/modules/event-ops/src/services/coordinators.service.test.ts -> apps/api/libs/modules/staffing-ops/src/services/coordinators.service.test.ts
apps/api/libs/modules/event-ops/src/services/event-read-models.service.test.ts -> apps/api/libs/modules/event-read-models/src/services/event-read-models.service.test.ts
apps/api/libs/modules/event-ops/src/services/suppliers.service.test.ts -> apps/api/libs/modules/supplier-ops/src/services/suppliers.service.test.ts
apps/api/libs/modules/event-ops/src/services/event-lifecycle.service.test.ts -> apps/api/libs/modules/event-core/src/services/event-lifecycle.service.test.ts
```

After moving each test, update relative imports to the owning module paths and run only that test file.

- [ ] **Step 5: Delete `event-ops/src/index.ts` after consumers are gone**

When old consumers are gone, remove `apps/api/libs/modules/event-ops/src/index.ts` instead of keeping an inert compatibility barrel. The final import check must prove no app/package/script import uses `@prism/modules/event-ops`.

## Task 8: Tighten Boundary Rules For The Target Shape

**Files:**
- Modify: `scripts/check-prism-boundaries.mjs`
- Modify: `scripts/check-prism-boundaries.test.mjs`

- [ ] **Step 1: Update allowed event-ops files**

In `scripts/check-prism-boundaries.mjs`, replace the large `legacyEventOpsServiceFiles` allowlist with a hard failure for any tracked file under:

```txt
apps/api/libs/modules/event-ops/
```

Do not keep an index-only allowlist; the goal is complete folder removal.

- [ ] **Step 2: Allow sample-compatibility as the only sample aggregate owner**

Add a rule that permits sample aggregation files only under:

```txt
apps/api/libs/modules/sample-compatibility/src/
```

The rule should fail every tracked file under `event-ops`, including controllers, DTOs, services, ports, tests, module files, and index barrels.

- [ ] **Step 3: Update boundary tests**

In `scripts/check-prism-boundaries.test.mjs`, add failing fixtures:

```js
'apps/api/libs/modules/event-ops/src/services/new-risk-workflow.service.ts': 'export class NewRiskWorkflowService {}',
'apps/api/libs/modules/event-ops/src/controllers/new-risk.controller.ts': 'export class NewRiskController {}',
'apps/api/libs/modules/event-ops/src/dto/new-risk.dto.ts': 'export class NewRiskDto {}',
```

Add passing fixtures:

```js
'apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts': 'export class SampleCompatibilityService {}',
'apps/api/libs/modules/sample-compatibility/src/controllers/sample.controller.ts': 'export class SampleController {}',
```

- [ ] **Step 4: Run boundary tests**

Run:

```powershell
node --test scripts/check-prism-boundaries.test.mjs
npm run check:boundaries
```

Expected: both pass.

## Task 9: Remove EventOps Alias And Library Registration

**Files:**
- Modify: `apps/api/tsconfig.json`
- Modify: `apps/api/vitest.config.ts`
- Modify: `apps/api/nest-cli.json`
- Delete: `apps/api/libs/modules/event-ops/`

- [ ] **Step 1: Confirm no imports remain**

Run:

```powershell
rg -n "@prism/modules/event-ops|event-ops/src|EventOpsModule|EventOpsService|EVENT_OPS_CONTROLLERS" apps packages scripts docs -S
```

Expected: only historical docs may mention `event-ops`. No app, package, or script imports should remain.

- [ ] **Step 2: Remove TypeScript aliases**

Delete these from `apps/api/tsconfig.json`:

```json
"@prism/modules/event-ops": [
  "libs/modules/event-ops/src/index"
],
"@prism/modules/event-ops/*": [
  "libs/modules/event-ops/src/*"
]
```

- [ ] **Step 3: Remove Vitest alias**

Delete this from `apps/api/vitest.config.ts`:

```ts
  '@prism/modules/event-ops': resolve(__dirname, './libs/modules/event-ops/src/index.ts'),
```

- [ ] **Step 4: Remove Nest CLI event-ops project**

Delete the `event-ops` project entry from `apps/api/nest-cli.json`.

- [ ] **Step 5: Delete the event-ops module folder**

Run:

```powershell
git ls-files apps/api/libs/modules/event-ops
```

After confirming Step 1 has no active imports, delete the entire module folder:

```powershell
git rm -r apps/api/libs/modules/event-ops
```

- [ ] **Step 6: Run target-shape verification**

Run:

```powershell
npm --workspace prism-api run build
npm --workspace prism-api run test -- libs/modules/sample-compatibility/src controller-routes.test.ts
npm run check:boundaries
git diff --check
```

Expected: all pass.

## Task 10: API Client Naming Without Breaking Public Routes

**Files:**
- Modify or keep: `packages/api-client/src/event-ops-client.ts`
- Optional create: `packages/api-client/src/sample-compatibility-client.ts`
- Modify: `packages/api-client/src/event-ops-client.test.ts`

- [ ] **Step 1: Keep public routes stable**

Do not change these route paths:

```txt
GET /api/sample/state
POST /api/sample/reset
POST /api/sample/seed
```

- [ ] **Step 2: Decide client naming by import inventory**

Run:

```powershell
rg -n "event-ops-client|sample\.state|sample\.reset|sample\.seed" apps packages scripts -S
```

If external or app imports still use `event-ops-client.ts`, keep that file as a compatibility export and create `sample-compatibility-client.ts` for the renamed implementation. If no imports exist, rename the file and update all internal imports.

- [ ] **Step 3: Run package tests**

Run:

```powershell
npm --workspace @prism/api-client test
```

If the package has a different script name, inspect `packages/api-client/package.json` and use the existing test script.

## Task 11: Documentation And Final Verification

**Files:**
- Modify: `docs/prism-v4/15-system-architecture.md`
- Modify: `docs/prism-v4/17-current-state-2026-06-20.md`
- Modify: `docs/superpowers/plans/2026-06-22-prism-backend-modular-monolith.md`
- Modify: `docs/superpowers/plans/2026-06-22-prism-event-ops-target-shape-plan.md`

- [ ] **Step 1: Update architecture docs to completed state**

In `docs/prism-v4/15-system-architecture.md`, change `event-ops` from compatibility owner to removed legacy module. Keep `sample-compatibility` as the owner of `/sample/*`.

- [ ] **Step 2: Update current-state docs**

In `docs/prism-v4/17-current-state-2026-06-20.md`, add a dated note:

```md
Post-snapshot target-shape cleanup: `/sample/state`, `/sample/reset`, and `/sample/seed` now live under `sample-compatibility`. `event-ops` no longer owns controllers, DTOs, services, or runtime module registration. Historical references remain only for traceability.
```

- [ ] **Step 3: Run final verification**

Run:

```powershell
npm --workspace prism-api run build
npm --workspace prism-api run test -- libs/modules/sample-compatibility/src
npm run check:boundaries
git diff --check
rg -n "@prism/modules/event-ops|event-ops/src|EventOpsModule|EventOpsService|EVENT_OPS_CONTROLLERS" apps packages scripts -S
```

Expected:

- build passes
- sample-compatibility tests pass
- boundary check passes
- `git diff --check` has no errors
- final `rg` returns no app/package/script imports of event-ops

## Review Checklist

Before merging the implementation branch:

- [ ] `apps/api/apps/api/src/app.module.ts` imports `SampleCompatibilityModule`, not `EventOpsModule`.
- [ ] `apps/api/libs/modules/sample-compatibility/src/controllers/sample.controller.ts` owns all `/sample/*` routes.
- [ ] `apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts` owns sample state/reset/seed orchestration.
- [ ] `apps/api/libs/modules/event-ops` is deleted.
- [ ] No active app/package/script import references `@prism/modules/event-ops` or `event-ops/src`.
- [ ] Boundary checker fails any tracked file under `apps/api/libs/modules/event-ops`.
- [ ] `event-core` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape, or missing folders are documented as intentionally unnecessary for current code.
- [ ] `inquiry-onboarding` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape.
- [ ] `supplier-ops` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape.
- [ ] `finance-ops` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape.
- [ ] `staffing-ops` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape.
- [ ] `floorplan` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape.
- [ ] `file-ops` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape.
- [ ] `live-ops` has the intended `controllers`, `dto`, `services`, `ports`, and `mappers` ownership shape.
- [ ] `event-read-models` has the intended `controllers`, `dto`, `services`, `queries`, and `mappers` ownership shape, with read-only query builders only.
- [ ] `sample-compatibility` has only `controllers`, `dto`, and `services`, and remains compatibility-only.
- [ ] Public `/api/sample/state`, `/api/sample/reset`, and `/api/sample/seed` routes still work.
- [ ] No role app uses `/api/sample/state` as a normal production read path.
- [ ] Docs identify `sample-compatibility` as a temporary compatibility module, not a new business owner.

## Commit Sequence

Use small commits so rollback is easy:

1. `docs(api): plan event ops target shape`
2. `refactor(api): normalize capability module folders`
3. `refactor(api): add sample compatibility module shell`
4. `refactor(api): move sample controller to compatibility module`
5. `refactor(api): move sample aggregate out of event ops`
6. `refactor(api): wire sample compatibility module`
7. `refactor(api): remove event ops compatibility exports`
8. `test(api): enforce event ops removal`
9. `refactor(api): delete legacy event ops module`
10. `refactor(api-client): name sample compatibility client`
11. `docs(api): record event ops target shape completion`

## Self-Review

Spec coverage: This plan covers the requested target shape by auditing every target capability module folder, moving controllers/DTOs/services/ports/mappers into owning modules, creating `sample-compatibility`, moving `/sample/*`, deleting `event-ops`, updating aliases/config, tightening boundary rules, preserving public routes, and updating docs.

Placeholder scan: The plan contains no unresolved implementation placeholders.

Type consistency: The planned module names are consistent: `SampleCompatibilityModule`, `SampleController`, `SampleCompatibilityService`, `SampleStateService`, and `SAMPLE_COMPATIBILITY_CONTROLLERS`. The target folder names match the requested shape: `controllers`, `dto`, `services`, `ports`, `mappers`, and `queries` for `event-read-models`.
