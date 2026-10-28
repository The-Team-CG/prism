/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { routeModel } = vi.hoisted(() => ({
  routeModel: {
    selectedEvent: undefined,
    events: [
      { id: "evt-gala", eventName: "Founders gala", clientName: "Acme", eventDate: "2027-05-15" },
      { id: "evt-expo", eventName: "Product expo", clientName: "Globex", eventDate: "2026-11-02" },
    ],
    navigateEvent: vi.fn(),
  } as Record<string, unknown> & { navigateEvent: ReturnType<typeof vi.fn> },
}));

vi.mock("../event-dashboard-route-context", () => ({
  useEventDashboardLoadedRouteViewModel: () => routeModel,
  useEventDashboardRouteViewModel: () => routeModel,
  useEventDashboardScopedRouteViewModel: () => routeModel,
}));

import {
  EventDashboardFilesSectionView,
  EventDashboardFinanceSectionView,
  EventDashboardMessagesSectionView,
} from "./event-dashboard-section-views";

afterEach(() => {
  cleanup();
  routeModel.navigateEvent.mockReset();
});

describe("global event-scoped destinations without a selected event", () => {
  it.each([
    ["Finance", EventDashboardFinanceSectionView, "Open billing", "billing"],
    ["Files", EventDashboardFilesSectionView, "Open files", "files"],
    ["Messages", EventDashboardMessagesSectionView, "Open messages", "activity"],
  ] as const)("%s lists events and opens the chosen event's matching section in one selection", (_name, View, action, tab) => {
    render(<View />);

    expect(screen.getByRole("heading", { name: "Choose an event" })).toBeTruthy();
    const rows = screen.getAllByRole("link", { name: new RegExp(`^${action}:`) });
    expect(rows.map((row) => row.getAttribute("title"))).toEqual(["Product expo", "Founders gala"]);
    expect(screen.getByText(/15 May 2027|May 15, 2027/)).toBeTruthy();

    const chosen = screen.getByRole("link", { name: `${action}: Founders gala` });
    expect(chosen.getAttribute("href")).toBe(`/dashboard/events/evt-gala/${tab}`);
    fireEvent.click(chosen);
    expect(routeModel.navigateEvent).toHaveBeenCalledWith("evt-gala", tab);
  });
});
