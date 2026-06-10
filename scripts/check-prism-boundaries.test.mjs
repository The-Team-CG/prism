import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findBoundaryViolations } from "./check-prism-boundaries.mjs";

describe("findBoundaryViolations", () => {
  it("allows role apps to import shared packages", () => {
    const violations = findBoundaryViolations({
      "apps/client/src/app/page.tsx": 'import { Button } from "@prism/ui";',
      "apps/event/src/app/page.tsx": 'import type { PrismEvent } from "@prism/types";',
      "packages/api-client/src/index.ts": 'import type { PrismDemoState } from "@prism/types";',
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
});
