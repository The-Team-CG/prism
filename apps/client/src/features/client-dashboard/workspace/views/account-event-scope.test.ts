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
    state: { documents: [{ id: "doc-b", eventId: "event-b", fileName: "agreement.pdf", type: "contract", status: "approved", uploadedAt: "2026-10-20" }], paymentMilestones: [] },
    router: { push: vi.fn(), replace: vi.fn() },
    session: { name: "Client", email: "client@example.test" },
    payments: [], billing: undefined, disputes: [], portalView: "files-all",
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

  it("shows real document records across events and links each event to its own documents", () => {
    mocks.workspace.selectedEvent = mocks.workspace.events[1];
    mocks.workspace.selectedEventId = "event-b";
    const markup = renderToStaticMarkup(createElement(ClientFilesView));
    expect(markup).toContain("Choose an event to see its files and requirements");
    expect(markup).toContain("Event B");
    expect(markup).toContain("agreement.pdf");
    expect(markup).toContain('href="/dashboard/events/event-b/documents"');
    expect(markup).not.toContain("Upload file");
  });

  it("links messages and approvals to the chosen event instead of a temporary selection", () => {
    for (const destination of ["messages", "approvals"] as const) {
      const markup = renderToStaticMarkup(createElement(ClientAccountEventPicker, { purpose: destination, destination }));
      expect(markup).toContain(`href="/dashboard/events/event-a/${destination}"`);
      expect(markup).toContain(`href="/dashboard/events/event-b/${destination}"`);
    }
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
