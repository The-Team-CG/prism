import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ESLint } from "eslint";
import { resolve } from "node:path";

const eslint = new ESLint({
  overrideConfigFile: resolve(process.cwd(), "eslint.config.mjs"),
});

async function messages(filePath, source) {
  const [result] = await eslint.lintText(source, { filePath: resolve(process.cwd(), filePath) });
  return result.messages.map(({ ruleId, message }) => ({ ruleId, message }));
}

describe("editor-time architecture lint", () => {
  it("reports cross-portal imports while allowing shared packages", async () => {
    assert.deepEqual(
      await messages(
        "apps/client/src/features/example.ts",
        'import { EventShell } from "@prism/event";\nimport type { PrismEvent } from "@prism/types";',
      ),
      [
        {
          ruleId: "prism/no-cross-portal-imports",
          message: "Role app 'client' must use package contracts, not another portal's internals.",
        },
      ],
    );
  });

  it("reports private bounded-context aliases but keeps public entrypoints valid", async () => {
    assert.deepEqual(
      await messages(
        "apps/api/src/modules/commercial/application/example.service.ts",
        'import { PublicPort } from "@prism/contexts/platform-ops";\nimport { AuditService } from "@prism/contexts/platform-ops/application/trust/audit.service";',
      ),
      [
        {
          ruleId: "prism/no-private-context-imports",
          message: "Import bounded-context capabilities through its public entrypoint, not a private implementation.",
        },
      ],
    );
  });

  it("reports local canonical input definitions and direct Zod imports", async () => {
    assert.deepEqual(
      await messages(
        "apps/client/src/lib/contracts.ts",
        'import { z } from "zod";\nexport type LoginInput = { email: string };\nexport const localSchema = z.object({ email: z.string() });',
      ),
      [
        {
          ruleId: "prism/no-inline-zod",
          message: "Zod schemas belong in packages/types/src/schemas; consume the shared contract instead of defining one here.",
        },
        {
          ruleId: "prism/no-local-contract-definitions",
          message: "Shared contract 'LoginInput' belongs in @prism/types; import the canonical type instead of redefining it locally.",
        },
      ],
    );
  });

  it("allows canonical schemas and the API Zod validation adapter", async () => {
    assert.deepEqual(
      await messages(
        "packages/types/src/schemas/example.ts",
        'import { z } from "zod";\nexport const exampleSchema = z.object({ email: z.string() });',
      ),
      [],
    );
    assert.deepEqual(
      await messages(
        "apps/api/src/kernel/shared/zod-validation.pipe.ts",
        'import type { ZodTypeAny } from "zod";',
      ),
      [],
    );
  });
});
