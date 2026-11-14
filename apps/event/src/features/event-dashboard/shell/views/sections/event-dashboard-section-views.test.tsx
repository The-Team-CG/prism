/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalQueryProvider } from "@prism/portal-query";

const { routeModel, communication } = vi.hoisted(() => ({
  communication: {
    listInbox: vi.fn(),
    listMessages: vi.fn(),
    markThreadRead: vi.fn(async () => ({ lastReadAt: "" })),
    listParticipants: vi.fn(async () => []),
    readReceipts: vi.fn(async () => []),
  },
  routeModel: {
    selectedEvent: undefined,
    session: { id: "pmcm", role: 'pmcm-admin' },
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
    communication,
    notificationPreferences: { mine: vi.fn(async () => ({ viberConfigured: false })) },
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
  it("shows ten events at a time, reveals the rest with Show more, and narrows by search", () => {
    const original = routeModel.events;
    routeModel.events = Array.from({ length: 12 }, (_, index) => ({
      id: `evt-${index}`,
      eventName: `Event ${String(index).padStart(2, "0")}`,
      clientName: "Acme",
      eventDate: `2027-01-${String(index + 1).padStart(2, "0")}`,
    }));
    try {
      render(<PortalQueryProvider actorKey="pmcm:test"><EventDashboardFinanceSectionView /></PortalQueryProvider>);
      expect(screen.getAllByRole("link", { name: /^Open billing:/ })).toHaveLength(10);

      fireEvent.click(screen.getByRole("button", { name: "Show more" }));
      expect(screen.getAllByRole("link", { name: /^Open billing:/ })).toHaveLength(12);

      fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Event 03" } });
      expect(screen.getAllByRole("link", { name: /^Open billing:/ }).map((row) => row.textContent)).toEqual(["Event 03"]);
    } finally {
      routeModel.events = original;
    }
  });

  it.each([
    ["Finance", EventDashboardFinanceSectionView, "Open billing", "billing"],
    ["Files", EventDashboardFilesSectionView, "Open files", "files"],
  ] as const)("%s lists events and opens the chosen event's matching section in one selection", async (_name, View, action, tab) => {
    render(<PortalQueryProvider actorKey="pmcm:test"><View /></PortalQueryProvider>);

    expect(screen.getByRole("heading", { name: "Choose an event" })).toBeTruthy();
    const rows = screen.getAllByRole("link", { name: new RegExp(`^${action}:`) });
    expect(rows.map((row) => row.textContent)).toEqual(["Product expo", "Founders gala"]);
    expect(screen.getAllByText(/15 May 2027|May 15, 2027/).length).toBeGreaterThan(0);

    const chosen = screen.getByRole("link", { name: `${action}: Founders gala` });
    expect(chosen.getAttribute("href")).toBe(`/dashboard/events/evt-gala/${tab}`);
    fireEvent.click(chosen);
    expect(routeModel.navigateEvent).toHaveBeenCalledWith("evt-gala", tab);
  });

  it("shows what each event owes on Finance and its open file requirements on Files", async () => {
    const { unmount } = render(<PortalQueryProvider actorKey="pmcm:test"><EventDashboardFinanceSectionView /></PortalQueryProvider>);
    expect(await screen.findByText(/₱260,000 due · next/)).toBeTruthy();
    // The other event has no milestones, so it owes nothing.
    expect(screen.getByText("Nothing owed")).toBeTruthy();
    unmount();

    render(<PortalQueryProvider actorKey="pmcm:test"><EventDashboardFilesSectionView /></PortalQueryProvider>);
    expect(await screen.findByText("6 of 8 requirements open · 1 overdue")).toBeTruthy();
    expect(screen.getByText("All requirements met")).toBeTruthy();
    expect(screen.queryByText(/due ·|Nothing owed/)).toBeNull();
  });

  it("opens Messages as one inbox across events, naming each conversation's event and who is in it", async () => {
    const message = (id: string, body: string) => ({ id, threadId: "thread-1", senderId: "client-1", senderRole: "client", senderName: "Ana Reyes", body, createdAt: "2026-11-12T08:00:00.000Z" });
    communication.listInbox.mockResolvedValue({ limit: 20, nextCursor: null, hasMore: false, items: [{
      id: "thread-1", eventId: "evt-gala", eventName: "Founders gala", subject: "Stage setup timing", status: "open", createdBy: "pmcm", createdAt: "2026-11-12T07:00:00.000Z", updatedAt: "2026-11-12T08:00:00.000Z",
      participants: [{ id: "p1", actorId: "pmcm", actorRole: "pmcm-admin", name: "Ms. Mys", active: true }, { id: "p2", actorId: "client-1", actorRole: "client", name: "Ana Reyes", active: true }],
      lastMessage: message("m2", "Can we move load-in to 2pm?"), unreadCount: 3,
    }] });
    communication.listMessages.mockResolvedValue({ items: [message("m1", "Good morning"), message("m2", "Can we move load-in to 2pm?")], limit: 100, nextCursor: null, hasMore: false });

    render(<PortalQueryProvider actorKey="pmcm:test"><EventDashboardMessagesSectionView /></PortalQueryProvider>);

    // No event has to be chosen first: the conversation and its event are listed straight away.
    expect(screen.queryByRole("heading", { name: "Choose an event" })).toBeNull();
    expect(await screen.findByText("Good morning")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Stage setup timing" })).toBeTruthy();
    expect(screen.getByText("Founders gala · You, Ana Reyes")).toBeTruthy();
    expect(communication.listMessages).toHaveBeenCalledWith("thread-1", { limit: 100 });
    expect(communication.markThreadRead).toHaveBeenCalledWith("thread-1");
  });
});
