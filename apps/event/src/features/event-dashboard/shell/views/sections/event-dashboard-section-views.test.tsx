/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalQueryProvider } from "@prism/portal-query";

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

vi.mock("@/lib/prism-api", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  eventApi: {
    pmcm: {
      fileSummaries: vi.fn(async () => ({
        generatedAt: "2026-11-05T00:00:00.000Z",
        items: [{ eventId: "evt-gala", total: 8, open: 6, overdue: 1 }, { eventId: "evt-expo", total: 8, open: 0, overdue: 0 }],
      })),
      eventSummaries: vi.fn(async () => ({
        generatedAt: "2026-11-05T00:00:00.000Z",
        items: [{ eventId: "evt-gala", balanceDue: 260000, nextPaymentDue: "2027-05-01", overdueMilestones: 0, unreadMessages: 2 }],
      })),
    },
  },
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
  ] as const)("%s lists events and opens the chosen event's matching section in one selection", async (_name, View, action, tab) => {
    render(<PortalQueryProvider actorKey="pmcm:test"><View /></PortalQueryProvider>);

    expect(screen.getByRole("heading", { name: "Choose an event" })).toBeTruthy();
    const rows = screen.getAllByRole("link", { name: new RegExp(`^${action}:`) });
    expect(rows.map((row) => row.getAttribute("title"))).toEqual(["Product expo", "Founders gala"]);
    expect(screen.getByText(/15 May 2027|May 15, 2027/)).toBeTruthy();

    const chosen = screen.getByRole("link", { name: `${action}: Founders gala` });
    expect(chosen.getAttribute("href")).toBe(`/dashboard/events/evt-gala/${tab}`);
    fireEvent.click(chosen);
    expect(routeModel.navigateEvent).toHaveBeenCalledWith("evt-gala", tab);
  });

  it("shows what each event owes on Finance, its unread messages on Messages and its open file requirements on Files", async () => {
    const { unmount } = render(<PortalQueryProvider actorKey="pmcm:test"><EventDashboardFinanceSectionView /></PortalQueryProvider>);
    expect(await screen.findByText(/₱260,000 due · next/)).toBeTruthy();
    // The other event has no milestones, so it owes nothing.
    expect(screen.getByText("Nothing owed")).toBeTruthy();
    unmount();

    render(<PortalQueryProvider actorKey="pmcm:test"><EventDashboardMessagesSectionView /></PortalQueryProvider>);
    expect(await screen.findByText("2 unread messages")).toBeTruthy();
    expect(screen.getByText("No unread messages")).toBeTruthy();
    cleanup();

    render(<PortalQueryProvider actorKey="pmcm:test"><EventDashboardFilesSectionView /></PortalQueryProvider>);
    expect(await screen.findByText("6 of 8 requirements open · 1 overdue")).toBeTruthy();
    expect(screen.getByText("All requirements met")).toBeTruthy();
    expect(screen.queryByText(/unread|due ·|Nothing owed/)).toBeNull();
  });
});
