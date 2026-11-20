import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// The Pascal chrome PRISM hides (ADR-0010, editor UI design) lives in patches/@pascal-app+editor+1.1.6.patch, applied on
// install. Each patched mount checks the host flag the editor sets, so this proves the patch is in place.
const editorSource = dirname(createRequire(import.meta.url).resolve("@pascal-app/editor"));
const PATCHED = [
  "lib/plugin-panels.ts",
  "components/editor/index.tsx",
  "components/editor/floorplan-panel.tsx",
  "components/ui/action-menu/view-toggles.tsx",
];

describe("Pascal chrome patch", () => {
  it.each(PATCHED)("is applied to %s", (file) => {
    expect(readFileSync(join(editorSource, file), "utf8")).toContain("__PRISM_HOST__");
  });
});
