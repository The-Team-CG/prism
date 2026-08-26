import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("event command home architecture", () => {
  it("keeps portal orchestration in feature ViewModels", () => {
    const source = readFileSync(new URL("./event-command-home-view.tsx", import.meta.url), "utf8");

    expect(source).toContain("useEventCommandHomeViewModel");
    expect(source).not.toContain("useEventOpsCommands");
    expect(source).not.toMatch(/use(?:State|Effect)\(/);
  });
});
