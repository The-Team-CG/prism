import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientPortalBillingView } from "../../billing/views/client-portal-billing-view";
import { ClientFilesView } from "../../files/views/client-files-view";
import { ClientAccountEventPicker } from "./sections/client-account-event-picker";

const mocks = vi.hoisted(() => ({
  workspace: {
    events: [
      { id: "event-a", eventName: "Event A", eventDate: "2026-10-20", status: "planning", venue: "Hall A" },
      { id: "event-b", eventName: "Event B", eventDate: "2026-10-21", status: "completed", venue: "Hall B" },
    ],
    selectedEvent: undefined as { id: string; eventName: string } | undefined,
    selectedEventId: null as string | null,
    setSelectedEventId: vi.fn(),
    state: {
      events: [
        { id: "event-a", eventName: "Event A", eventDate: "2026-10-20", status: "planning", venue: "Hall A", clientPortalStatus: "unlocked" },
        { id: "event-b", eventName: "Event B", eventDate: "2026-10-21", status: "completed", venue: "Hall B", clientPortalStatus: "unlocked" },
      ],
      documents: [
        { id: "doc-a", eventId: "event-a", fileName: "run-of-show.pdf", type: "briefing", status: "approved", uploadedAt: "2026-10-19" },
        { id: "doc-b", eventId: "event-b", fileName: "agreement.pdf", type: "contract", status: "approved", uploadedAt: "2026-10-20" },
      ],
      paymentMilestones: [],
    },
    router: { push: vi.fn(), replace: vi.fn() },
    session: { name: "Client", email: "client@example.test" },
    payments: [], billing: undefined, disputes: [], portalView: "files-all",
  },
}));
vi.mock("@prism/portal-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@prism/portal-query")>()),
  useInvalidate: () => vi.fn(),
  useResource: (resource: { name: string }, eventId: string | null) => {
    if (resource.name === "client.event-stored-files") return { status: "ready", data: [], error: null, refreshing: false };
    if (resource.name === "client.event-file-requirements") {
      const items = eventId === "event-a" ? [{ key: "permit", label: "Venue permit", ownerRole: "client", origin: "custom", status: "missing", required: true, overdue: false }] : [];
      return { status: "ready", data: { eventId, items }, error: null, refreshing: false };
    }
    return { status: "pending", data: undefined, error: null, refreshing: false };
  },
}));
vi.mock("../client-workspace-context", () => ({ useClientWorkspace: () => mocks.workspace }));
vi.mock("../shared", async (importOriginal) => ({ ...(await importOriginal<typeof import("../shared")>()), useClientWorkspace: () => mocks.workspace }));

afterEach(() => {
  mocks.workspace.selectedEvent = undefined;
  mocks.workspace.selectedEventId = null;
});

describe("account pages with multiple events", () => {
  it("offers an event choice for billing before showing event details", () => {
    const markup = renderToStaticMarkup(createElement(ClientPortalBillingView));
    expect(markup).toContain("Choose an event to see its billing");
    expect(markup).toContain('href="/dashboard/events/event-a/billing"');
    expect(markup).toContain('href="/dashboard/events/event-b/billing"');
    expect(markup).toContain("Oct 20, 2026");
    expect(markup).toContain("Hall A");
    expect(markup).not.toContain("No billing workspace yet");
  });

  it("opens Files on the next upcoming event with what it still needs, keeping past events listed for later", () => {
    const markup = renderToStaticMarkup(createElement(ClientFilesView));
    expect(markup).toContain("Upcoming");
    expect(markup).toContain("Past");
    expect(markup).toContain("Event B");
    expect(markup).toContain("Needed from you");
    expect(markup).toContain("Venue permit");
    expect(markup).toContain("run-of-show.pdf");
    expect(markup).toContain('href="/dashboard/events/event-a/documents"');
    expect(markup).not.toContain("agreement.pdf");
  });

  it("links approvals to the chosen event instead of a temporary selection", () => {
    const markup = renderToStaticMarkup(createElement(ClientAccountEventPicker, { purpose: "approvals", destination: "approvals" }));
    expect(markup).toContain('href="/dashboard/events/event-a/approvals"');
    expect(markup).toContain('href="/dashboard/events/event-b/approvals"');
  });

  it("opens the only event's section directly, keeping a link as the fallback", () => {
    const original = mocks.workspace.events;
    try {
      mocks.workspace.events = [original[0]];
      mocks.workspace.selectedEvent = original[0];
      const markup = renderToStaticMarkup(createElement(ClientPortalBillingView));
      expect(markup).toContain("Opening billing for");
      expect(markup).not.toContain("Choose an event");
      expect(markup).toContain('href="/dashboard/events/event-a/billing"');
    } finally {
      mocks.workspace.events = original;
    }
  });
});
