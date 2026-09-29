import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findBoundaryViolations } from "./check-prism-boundaries.mjs";

describe("findBoundaryViolations", () => {
  const removedSourceRoot = "apps/api/libs/modules/event-ops/src";

  it("allows role apps to import shared packages", () => {
    const violations = findBoundaryViolations({
      "apps/client/src/app/page.tsx": 'import { Button } from "@prism/ui";',
      "apps/event/src/app/page.tsx": 'import type { PrismEvent } from "@prism/types";',
      "packages/api-client/src/index.ts": 'import type { PrismSampleState } from "@prism/types";',
    });

    assert.deepEqual(violations, []);
  });


  it("allows the shared floorplan canvas to import only neutral shared packages", () => {
    assert.deepEqual(findBoundaryViolations({
      "packages/floorplan-canvas/src/index.ts": 'import type { CreatePrismInquiryInput } from "@prism/types";',
      "packages/floorplan-canvas/src/Canvas.tsx": 'import { useState } from "react";',
    }), []);

    for (const imported of [
      "@/lib/prism-api",
      "apps/client/src/lib/prism-api",
      "@prism/api-client",
      "@prism/event",
      "@prism/ui",
    ]) {
      assert.deepEqual(findBoundaryViolations({
        "packages/floorplan-canvas/src/Canvas.tsx": `import { value } from "${imported}";`,
      }), [
        "packages/floorplan-canvas/src/Canvas.tsx: shared floorplan canvas must not import apps, portals, UI or API clients",
      ]);
    }
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
      "apps/event/src/app/dashboard/page.tsx": "eventOpsClient.sample.state();",
    });

    assert.deepEqual(violations, [
      "apps/client/src/app/page.tsx: role apps must not import the client mock sample dataset",
      "apps/guest/src/app/dashboard/page.tsx: role apps must use shared Prism session and sample storage keys",
      "apps/event/src/app/dashboard/page.tsx: role apps must not read the broad sample state aggregate",
    ]);
  });

  it("blocks backend modular-monolith boundary violations", () => {
    const violations = findBoundaryViolations({
      "apps/api/src/modules/commercial/application/suppliers/supplier.service.ts":
        'import { AuditService } from "@prism/contexts/platform-ops/application/trust/audit.service";',
      "apps/api/src/modules/event-lifecycle/application/archive.service.ts":
        'import { BillingOperationsService } from "apps/api/src/modules/commercial/application/billing/billing-operations.service";',
      "apps/api/src/modules/read-models/application/services/pmcm-read-model.service.ts":
        "await this.prisma.opsEvent.update({ where: { id }, data: input });",
      "apps/api/src/modules/read-models/application/queries/raw-dashboard.service.ts":
        "await this.prisma.$queryRaw('select * from ops_event');",
      [removedSourceRoot + "/services/new-risk-workflow.service.ts"]: "export class NewRiskWorkflowService {}",
      [removedSourceRoot + "/controllers/new-risk.controller.ts"]: "export class NewRiskController {}",
      "packages/ui/src/backend-button.tsx": 'import { RemovedService } from "@prism/kernel/event-core";',
    });

    assert.deepEqual(violations, [
      "apps/api/src/modules/commercial/application/suppliers/supplier.service.ts: backend code must use public context and kernel entrypoints",
      "apps/api/src/modules/event-lifecycle/application/archive.service.ts: backend contexts must not import another context's private implementation",
      "apps/api/src/modules/read-models/application/services/pmcm-read-model.service.ts: read models must not mutate Prisma state",
      "apps/api/src/modules/read-models/application/queries/raw-dashboard.service.ts: read models raw queries require an approved query builder with a query budget",
      removedSourceRoot + "/services/new-risk-workflow.service.ts: legacy backend source roots must remain empty after DDD consolidation",
      removedSourceRoot + "/controllers/new-risk.controller.ts: legacy backend source roots must remain empty after DDD consolidation",
      "packages/ui/src/backend-button.tsx: shared ui must not import backend modules",
    ]);
  });

  it("allows approved backend modular-monolith patterns", () => {
    const violations = findBoundaryViolations({
      "apps/api/src/modules/commercial/application/suppliers/supplier.service.ts":
        'import { PLATFORM_AUDIT } from "@prism/contexts/platform-ops";',
      "apps/api/src/modules/read-models/application/queries/pmcm-event-dashboard.query.ts":
        "// Query budget: one event summary query plus one scoped relation query.\nawait this.prisma.$queryRaw('select id from ops_event');",
      "apps/api/src/modules/read-models/application/services/pmcm-read-model.service.ts":
        "await this.prisma.opsEvent.findMany({ where: { id } });",
      "apps/api/src/compatibility/sample/services/sample-compatibility.service.ts":
        'import { EventCoreModule } from "@prism/kernel/event-core";',
    });

    assert.deepEqual(violations, []);
  });

  it("allows only the focused closeout read entrypoint, not its private implementation", () => {
    const path = 'apps/api/src/modules/event-lifecycle/application/files/matrix.service.ts';
    assert.deepEqual(findBoundaryViolations({ [path]:
      'import { readUnresolvedCloseoutIssues } from "@prism/contexts/read-models/closeout";',
    }), []);
    assert.deepEqual(findBoundaryViolations({ [path]:
      'import { readEventAccessScope } from "@prism/contexts/read-models/event-scope";',
    }), []);
    for (const imported of ['@prism/contexts/read-models/application/queries/closeout-issue-reader', '@prism/contexts/read-models/closeout/private', '@prism/contexts/read-models/event-scope/private']) {
      assert.deepEqual(findBoundaryViolations({ [path]: `import { reader } from "${imported}";` }), [
        `${path}: backend code must use public context and kernel entrypoints`,
      ]);
    }
  });

  it("allows the focused conforme reminder claim seam only", () => {
    const path = "apps/api/src/modules/platform-ops/application/ai-governance/conforme-comms-draft.service.ts";
    assert.deepEqual(findBoundaryViolations({ [path]:
      'import { CONFORME_REMINDER_WINDOW_CLAIMER } from "@prism/contexts/event-lifecycle/conforme-reminder-window";',
    }), []);
    for (const imported of ["@prism/contexts/event-lifecycle/application/onboarding/inquiries.service", "@prism/contexts/event-lifecycle/conforme-reminder-window/private"]) {
      assert.deepEqual(findBoundaryViolations({ [path]: `import { InquiryService } from "${imported}";` }), [
        `${path}: backend code must use public context and kernel entrypoints`,
      ]);
    }
  });

  it("confines provider SDK imports to gateway infrastructure after the PARE migration", () => {
    const allowedAdapter = "apps/api/src/modules/platform-ops/infrastructure/ai-governance/anthropic.adapter.ts";
    const migratedAgent = "apps/api/src/modules/platform-ops/application/ai-governance/pare/agents/budget.agent.ts";
    const blockedPortal = "apps/event/src/features/pare/data/provider.ts";
    const blockedBackend = "apps/api/src/modules/commercial/application/provider.ts";
    const blockedSharedTypes = "packages/types/src/provider.ts";
    const mockOnlyTest = "apps/api/src/modules/platform-ops/application/ai-governance/pare/pare-safety.test.ts";

    assert.deepEqual(
      findBoundaryViolations({
        [allowedAdapter]: 'import Anthropic from "@anthropic-ai/sdk";',
        [migratedAgent]: 'const sdk = await import("@anthropic-ai/sdk");',
        [mockOnlyTest]: 'vi.mock("@anthropic-ai/sdk");',
        [blockedPortal]: 'const sdk = await import("openai");',
        [blockedBackend]: 'const sdk = require("@openrouter/sdk");',
        [blockedSharedTypes]: 'import type { Anthropic } from "@anthropic-ai/sdk";',
      }),
      [
        `${migratedAgent}: provider SDK imports must stay in AI gateway infrastructure`,
        `${blockedPortal}: provider SDK imports must stay in AI gateway infrastructure`,
        `${blockedBackend}: provider SDK imports must stay in AI gateway infrastructure`,
        `${blockedSharedTypes}: provider SDK imports must stay in AI gateway infrastructure`,
      ],
    );
  });
});
