import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("event dashboard shell architecture", () => {
  it("keeps route composition in the route view and leaves the shell presentational", () => {
    const routeSource = readFileSync(new URL("./event-dashboard-route-view.tsx", import.meta.url), "utf8");
    const contentSource = readFileSync(new URL("./event-dashboard-route-content-view.tsx", import.meta.url), "utf8");
    const shellSource = readFileSync(new URL("./event-dashboard-shell-view.tsx", import.meta.url), "utf8");

    expect(routeSource).toContain("useEventDashboardShellViewModel");
    expect(routeSource).toContain("EventDashboardShellView");
    expect(routeSource).toContain("children");
    expect(contentSource).toContain("{children}");
    expect(contentSource).not.toContain("SECTION_VIEWS");
    expect(contentSource).not.toContain("useEventDashboardRouteViewModel");
    expect(routeSource).not.toContain("return null");
    expect(shellSource).not.toContain("useEventDashboardShellViewModel");
    expect(shellSource).not.toContain("usePathname");
    expect(shellSource).not.toContain("EventCalendarWorkspace");
  });

  it("lets the App Router page own the route slot", () => {
    const source = readFileSync(new URL("../../../../app/(portal)/dashboard/layout.tsx", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../../../../app/(portal)/dashboard/page.tsx", import.meta.url), "utf8");
    const eventPageSource = readFileSync(
      new URL("../../../../app/(portal)/dashboard/events/page.tsx", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("EventDashboardShellView");
    expect(source).toContain("return children");
    expect(pageSource).toContain("EventDashboardHomeSectionView");
    expect(eventPageSource).toContain("EventDashboardEventsListSectionView");
  });

  it("keeps pathname parsing out of the dashboard ViewModel", () => {
    const vmSource = readFileSync(
      new URL("../view-models/use-event-dashboard-shell-view-model.ts", import.meta.url),
      "utf8",
    );

    expect(vmSource).not.toContain("usePathname");
    expect(vmSource).not.toContain("routeStateFromPath");
  });

  it("keeps workspace loading behind a dedicated feature ViewModel", () => {
    const vmSource = readFileSync(
      new URL("../view-models/use-event-dashboard-shell-view-model.ts", import.meta.url),
      "utf8",
    );

    expect(vmSource).toContain("useEventDashboardWorkspaceViewModel");
    expect(vmSource).not.toContain("getCachedPmcmState");
    expect(vmSource).not.toContain("loadEventCommandData");
  });

  it("keeps shared PMCM selectors in the canonical PMCM model", () => {
    const source = readFileSync(
      new URL("../../../pmcm-kit/model/pmcm-dashboard-selectors.ts", import.meta.url),
      "utf8",
    );
    const vmSource = readFileSync(
      new URL("../view-models/use-event-dashboard-shell-view-model.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toContain("event-workspace");
    expect(source).not.toContain("command-inbox");
    expect(vmSource).toContain("pmcm-kit/model/pmcm-dashboard-selectors");
    expect(vmSource).not.toContain("@/features/event-workspace/shell\";");
  });

  it("keeps static nav configuration out of the main view-model file", () => {
    const vmSource = readFileSync(
      new URL("../view-models/use-event-dashboard-shell-view-model.ts", import.meta.url),
      "utf8",
    );
    expect(vmSource).not.toContain("lucide-react");
  });

  it("retires the cross-feature event-ops facade", () => {
    const sourceRoot = new URL("../../..", import.meta.url);
    const sourceFiles: string[] = [];

    function collectFiles(url: URL) {
      for (const entry of readdirSync(url, { withFileTypes: true })) {
        const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, url);
        if (entry.isDirectory()) {
          collectFiles(child);
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
          sourceFiles.push(readFileSync(child, "utf8"));
        }
      }
    }

    collectFiles(sourceRoot);
    const retiredFacade = ["features", "event-ops"].join("/");
    expect(sourceFiles.join("\n")).not.toContain(retiredFacade);
    expect(sourceFiles.join("\n")).not.toContain("useEventOpsCommands");
    expect(sourceFiles.join("\n")).not.toContain("eventOpsRepository");
  });
});
