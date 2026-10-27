import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientPortalBillingView } from "../../billing/views/client-portal-billing-view";
import { ClientFilesView } from "../../files/views/client-files-view";
import { ClientAccountEventPicker } from "./sections/client-account-event-picker";

const mocks = vi.hoisted(() => ({
  workspace: {
    events: [{ id: "event-a", eventName: "Event A" }, { id: "event-b", eventName: "Event B" }],
    selectedEvent: undefined as { id: string; eventName: string } | undefined,
    selectedEventId: null as string | null,
    setSelectedEventId: vi.fn(),
    state: { documents: [{ id: "doc-b", eventId: "event-b", fileName: "agreement.pdf", type: "contract", status: "approved", uploadedAt: "2026-10-20" }] },
    router: { push: vi.fn() },
    session: { name: "Client", email: "client@example.test" },
    payments: [], billing: undefined, disputes: [], portalView: "files-all",
  },
}));
vi.mock("../client-workspace-context", () => ({ useClientWorkspace: () => mocks.workspace }));
vi.mock("../shared", () => ({ useClientWorkspace: () => mocks.workspace, formatStatusLabel: (value: string) => value }));

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
    expect(markup).not.toContain("No billing workspace yet");
  });

  it("shows real document records across events and links each event to its own documents", () => {
    mocks.workspace.selectedEvent = mocks.workspace.events[1];
    mocks.workspace.selectedEventId = "event-b";
    const markup = renderToStaticMarkup(createElement(ClientFilesView));
    expect(markup).toContain("Choose an event to see its event files and requirements");
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

  it("offers a direct event link even when there is only one event", () => {
    const original = mocks.workspace.events;
    try {
      mocks.workspace.events = [original[0]];
      mocks.workspace.selectedEvent = original[0];
      const markup = renderToStaticMarkup(createElement(ClientPortalBillingView));
      expect(markup).toContain("Choose an event to see its billing");
      expect(markup).toContain('href="/dashboard/events/event-a/billing"');
    } finally {
      mocks.workspace.events = original;
    }
  });
});
