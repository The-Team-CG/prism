import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("event dashboard shell architecture", () => {
  it("keeps route orchestration in the feature ViewModel", () => {
    const source = readFileSync(new URL("./event-dashboard-shell-view.tsx", import.meta.url), "utf8");

    expect(source).toContain("useEventDashboardShellViewModel");
    expect(source).not.toContain("useEventOpsCommands");
    expect(source).not.toMatch(/use(?:State|Effect)\(/);
  });

  it("keeps static nav configuration out of the main view-model file", () => {
    const vmSource = readFileSync(
      new URL("../view-models/use-event-dashboard-shell-view-model.ts", import.meta.url),
      "utf8",
    );
    expect(vmSource).not.toContain("lucide-react");
  });
});
