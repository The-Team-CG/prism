import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClientPortalBillingView } from "../../billing/views/client-portal-billing-view";
import { ClientFilesView } from "../../files/views/client-files-view";

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
vi.mock("../../files/views/client-stored-files-panel", () => ({ ClientStoredFilesPanel: ({ eventId }: { eventId: string }) => `Stored files for ${eventId}` }));
vi.mock("../../files/views/client-file-requirements-matrix", () => ({ ClientFileRequirementsMatrix: ({ eventId }: { eventId: string }) => `Requirements for ${eventId}` }));
vi.mock("../../billing/views/client-billing-tab", () => ({ ClientBillingTab: () => "Billing detail" }));

afterEach(() => {
  mocks.workspace.selectedEvent = undefined;
  mocks.workspace.selectedEventId = null;
});

describe("account pages with multiple events", () => {
  it("offers an event choice for billing before showing event details", () => {
    const markup = renderToStaticMarkup(createElement(ClientPortalBillingView));
    expect(markup).toContain("Choose an event to see its billing");
    expect(markup).not.toContain("No billing workspace yet");
    expect(markup).not.toContain("Billing detail");
  });

  it("shows real document records across events but opens file controls only for the selected event", () => {
    const before = renderToStaticMarkup(createElement(ClientFilesView));
    expect(before).toContain("Choose an event to see its event files and requirements");
    expect(before).toContain("Event B");
    expect(before).toContain("agreement.pdf");
    expect(before).not.toContain("Stored files for");

    mocks.workspace.selectedEvent = mocks.workspace.events[1];
    mocks.workspace.selectedEventId = "event-b";
    const after = renderToStaticMarkup(createElement(ClientFilesView));
    expect(after).toContain("Stored files for event-b");
    expect(after).toContain("Requirements for event-b");
    expect(after).not.toContain("Stored files for event-a");
  });
});
