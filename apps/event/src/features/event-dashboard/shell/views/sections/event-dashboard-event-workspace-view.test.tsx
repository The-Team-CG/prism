import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { routeModel } = vi.hoisted(() => ({
  routeModel: {
    selectedEvent: { id: "event-42" },
    tab: "files",
  },
}));

vi.mock("../event-dashboard-route-context", () => ({
  useEventDashboardLoadedRouteViewModel: () => routeModel,
}));
vi.mock("./event-dashboard-section-views", () => ({
  EventDashboardFilesSectionView: () => createElement("section", { "data-testid": "event-file-hub" }, routeModel.selectedEvent.id),
}));
vi.mock("./event-workspace-header", () => ({
  EmptyEventWorkspace: () => null,
  EventWorkspaceHeader: () => null,
}));
vi.mock("./event-workspace-tabs", () => ({
  EventWorkspaceActivityTab: () => null,
  EventWorkspaceBillingTab: () => null,
  EventWorkspaceBriefingTab: () => null,
  EventWorkspaceClosureTab: () => null,
  EventWorkspaceCoordinatorsTab: () => null,
  EventWorkspaceFloorplansTab: () => null,
  EventWorkspaceLiveOpsTab: () => null,
  EventWorkspaceOverviewTab: () => null,
  EventWorkspaceRegistrationTab: () => null,
  EventWorkspaceSuppliersTab: () => null,
}));

import { EventDashboardEventWorkspaceView } from "./event-dashboard-event-workspace-view";

describe("EventDashboardEventWorkspaceView", () => {
  it("renders the files view for a selected event while keeping files separate from floorplans", () => {
    routeModel.tab = "files";
    const files = renderToStaticMarkup(createElement(EventDashboardEventWorkspaceView));
    routeModel.tab = "floorplans";
    const floorplans = renderToStaticMarkup(createElement(EventDashboardEventWorkspaceView));

    expect(files).toContain('data-testid="event-file-hub"');
    expect(files).toContain("event-42");
    expect(floorplans).not.toContain('data-testid="event-file-hub"');
  });
});
