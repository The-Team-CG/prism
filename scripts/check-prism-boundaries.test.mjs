import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findBoundaryViolations } from "./check-prism-boundaries.mjs";

describe("findBoundaryViolations", () => {
  const removedModule = "event" + "-ops";
  const removedImport = `@prism/modules/${removedModule}`;
  const removedSourceRoot = `apps/api/libs/modules/${removedModule}/src`;

  it("allows role apps to import shared packages", () => {
    const violations = findBoundaryViolations({
      "apps/client/src/app/page.tsx": 'import { Button } from "@prism/ui";',
      "apps/event/src/app/page.tsx": 'import type { PrismEvent } from "@prism/types";',
      "packages/api-client/src/index.ts": 'import type { PrismSampleState } from "@prism/types";',
    });

    assert.deepEqual(violations, []);
  });

  it("blocks role app imports across app boundaries", () => {
    const violations = findBoundaryViolations({
      "apps/client/src/app/page.tsx": 'import { EventShell } from "@prism/event";',
      "apps/event/src/app/page.tsx": 'import { ClientShell } from "apps/client/src/app/page";',
    });

    assert.deepEqual(violations, [
      "apps/client/src/app/page.tsx: client app must not import event app internals",
      "apps/event/src/app/page.tsx: event app must not import client app internals",
    ]);
  });

  it("keeps shared packages free of app-local imports", () => {
    const violations = findBoundaryViolations({
      "packages/ui/src/card.tsx": 'import { cn } from "@/lib/utils";',
      "packages/types/src/event-ops.ts": 'import type { ReactNode } from "react";',
      "packages/api-client/src/event-ops-client.ts": 'import { prismApi } from "apps/client/src/lib/prism-api";',
    });

    assert.deepEqual(violations, [
      "packages/ui/src/card.tsx: shared ui must not import app-local modules",
      "packages/types/src/event-ops.ts: shared types must not import React or app modules",
      "packages/api-client/src/event-ops-client.ts: api client must not import role app modules",
    ]);
  });

  it("blocks redesign work from adding new sample-state or storage-key coupling", () => {
    const violations = findBoundaryViolations({
      "apps/client/src/app/page.tsx": 'import { createInitialPrismSampleState } from "@/mock/prism-sample-state";',
      "apps/client/src/lib/prism-api.ts": 'import { createInitialPrismSampleState } from "@/mock/prism-sample-state";',
      "apps/guest/src/app/dashboard/page.tsx": 'const key = "prism:guest-session";',
      "apps/event/src/app/dashboard/page.tsx": 'eventOpsClient.sample.state();',
    });

    assert.deepEqual(violations, [
      "apps/client/src/app/page.tsx: role apps must not import the client mock sample dataset",
      "apps/guest/src/app/dashboard/page.tsx: role apps must use shared Prism session and sample storage keys",
      "apps/event/src/app/dashboard/page.tsx: role apps must not read the broad sample state aggregate",
    ]);
  });

  it("blocks backend modular-monolith boundary violations", () => {
    const violations = findBoundaryViolations({
      "apps/api/libs/modules/supplier-ops/src/services/supplier.service.ts":
        'import { BillingOperationsService } from "@prism/modules/finance-ops/src/services/billing-operations.service";',
      "apps/api/libs/modules/finance-ops/src/services/payment.service.ts":
        `import { RemovedService } from "${removedImport}";`,
      "apps/api/libs/modules/closure-ops/src/services/archive.service.ts":
        `import { LocalClosureService } from "@prism/modules/closure-ops/src/services/local-closure.service";\nimport { BillingOperationsService } from "../../finance-ops/src/services/billing-operations.service";\nimport { RemovedClosureService } from "${removedImport}/src/services/event-closure.service";`,
      "apps/api/libs/modules/event-read-models/src/services/pmcm-read-model.service.ts":
        "await this.prisma.opsEvent.update({ where: { id }, data: input });",
      "apps/api/libs/modules/event-read-models/src/services/raw-dashboard.service.ts":
        "await this.prisma.$queryRaw`select * from ops_event`;",
      [`${removedSourceRoot}/services/new-risk-workflow.service.ts`]: "export class NewRiskWorkflowService {}",
      [`${removedSourceRoot}/controllers/new-risk.controller.ts`]: "export class NewRiskController {}",
      "packages/ui/src/backend-button.tsx": `import { RemovedService } from "${removedImport}";`,
    });

    assert.deepEqual(violations, [
      "apps/api/libs/modules/supplier-ops/src/services/supplier.service.ts: backend capability modules must not import private services from other capability modules",
      "apps/api/libs/modules/finance-ops/src/services/payment.service.ts: backend capability modules must not import event-ops compatibility internals",
      "apps/api/libs/modules/closure-ops/src/services/archive.service.ts: backend capability modules must not import private services from other capability modules",
      "apps/api/libs/modules/closure-ops/src/services/archive.service.ts: backend capability modules must not import event-ops compatibility internals",
      "apps/api/libs/modules/event-read-models/src/services/pmcm-read-model.service.ts: event-read-models must not mutate Prisma state",
      "apps/api/libs/modules/event-read-models/src/services/raw-dashboard.service.ts: event-read-models raw queries require an approved query builder with a query budget",
      `${removedSourceRoot}/services/new-risk-workflow.service.ts: event-ops module must not contain tracked files after sample compatibility migration`,
      `${removedSourceRoot}/controllers/new-risk.controller.ts: event-ops module must not contain tracked files after sample compatibility migration`,
      "packages/ui/src/backend-button.tsx: shared ui must not import backend modules",
    ]);
  });

  it("allows approved backend modular-monolith patterns", () => {
    const violations = findBoundaryViolations({
      "apps/api/libs/modules/supplier-ops/src/services/supplier.service.ts":
        'import { FINANCE_COMMANDS } from "@prism/modules/finance-ops";',
      "apps/api/libs/modules/event-read-models/src/queries/pmcm-event-dashboard.query.ts":
        "// Query budget: one event summary query plus one scoped relation query.\nawait this.prisma.$queryRaw`select id from ops_event`;",
      "apps/api/libs/modules/event-read-models/src/services/pmcm-read-model.service.ts":
        "await this.prisma.opsEvent.findMany({ where: { id } });",
      "apps/api/libs/modules/sample-compatibility/src/services/sample-compatibility.service.ts":
        'import { EventCoreModule } from "@prism/modules/event-core";',
    });

    assert.deepEqual(violations, []);
  });
});