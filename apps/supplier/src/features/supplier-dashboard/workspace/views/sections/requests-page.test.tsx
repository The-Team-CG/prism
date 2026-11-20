/** @vitest-environment jsdom */
import type { ReactElement } from "react";
import { cleanup, fireEvent, render as renderPlain, screen, within } from "@testing-library/react";
import { PortalQueryProvider } from "@prism/portal-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RequestsPage } from "./requests-page";

const render = (ui: ReactElement) => renderPlain(<PortalQueryProvider actorKey="ops@xperto.test">{ui}</PortalQueryProvider>);

const request = (id: string, over: Record<string, unknown> = {}) => ({
  id, eventId: `evt_${id}`, supplierName: "XPERTO", category: "Digital Registration", message: `Brief for ${id}`, accessToken: "t",
  confidentialBid: false, status: "sent", createdAt: "2026-11-01T00:00:00.000Z", dueDate: "2026-11-28T09:00:00.000Z", ...over,
});
const quote = (requestId: string, over: Record<string, unknown> = {}) => ({
  id: `q_${requestId}`, eventId: `evt_${requestId}`, requestId, supplierName: "XPERTO", category: "Digital Registration", amount: 420000, inclusions: [],
  paymentTerms: "50% deposit; balance after event", notes: "", outsideAcceptableRange: false, status: "submitted", revisionNumber: 1, createdAt: "2026-11-10T00:00:00.000Z", ...over,
});

const onSubmitQuote = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
const onUpdateForm = vi.fn();

function renderPage() {
  const quotes = [quote("sent"), quote("lost", { status: "not_selected" })];
  const workspace = {
    supplier: { id: "sup" },
    quoteRequests: [request("open"), request("sent"), request("lost", { status: "closed" })],
    supplierQuotes: quotes,
  };
  const board = { items: [
    { requestId: "open", eventId: "evt_open", eventName: "Harbor Bank Product Launch", eventDate: "2027-06-03", quoteStatus: "sent" },
    { requestId: "sent", eventId: "evt_sent", eventName: "UAT Operations Supplier Booking", eventDate: "2026-12-18", quoteStatus: "sent" },
  ] };
  return render(
    <RequestsPage
      workspace={workspace as never}
      quoteByRequest={new Map(quotes.map((item) => [item.requestId, item])) as never}
      readinessBoard={board as never}
      forms={{}}
      busy={null}
      onUpdateForm={onUpdateForm}
      onSubmitQuote={onSubmitQuote as never}
    />,
  );
}

const section = (name: RegExp) => screen.getByRole("heading", { name }).closest("section") as HTMLElement;

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-20T04:00:00.000Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); window.history.replaceState(null, "", "/"); });

describe("supplier requests as cards", () => {
  it("groups requests into ones to price, quotes with PMCM and closed ones, each with its deadline and next step", () => {
    renderPage();
    const toQuote = section(/Needs your quote/);
    expect(within(toQuote).getByText("Harbor Bank Product Launch")).toBeTruthy();
    expect(within(toQuote).getByText("Due in 8 days")).toBeTruthy();
    expect(within(toQuote).getByRole("button", { name: "Prepare quote" })).toBeTruthy();
    const sent = section(/Sent to PMCM/);
    expect(within(sent).getByText("1 revision left")).toBeTruthy();
    expect(within(sent).getByText("₱420,000")).toBeTruthy();
    expect(within(section(/^Closed/)).getByText("Not selected")).toBeTruthy();
  });

  it("opens the request's brief and quote form in a panel, fills common terms in one tap, and sends the quote", () => {
    renderPage();
    fireEvent.click(within(section(/Needs your quote/)).getByRole("button", { name: "Prepare quote" }));
    const panel = screen.getByRole("dialog", { name: "Harbor Bank Product Launch" });
    expect(within(panel).getByText("Brief for open")).toBeTruthy();
    expect(window.location.hash).toBe("#supplier-work-open");
    fireEvent.click(within(panel).getByRole("button", { name: "Full payment after the event" }));
    expect(onUpdateForm).toHaveBeenCalledWith("open", { paymentTerms: "Full payment after the event" });
    // The form's values live in the workspace view model (mocked here), so submit the form rather than fill it.
    fireEvent.submit(within(panel).getByRole("button", { name: "Send quote to PMCM" }).closest("form")!);
    expect(onSubmitQuote).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "open" }));
  });

  it("opens the request a work link names, as the Today page sends", () => {
    window.history.replaceState(null, "", "/dashboard/requests#supplier-work-sent");
    renderPage();
    const panel = screen.getByRole("dialog", { name: "UAT Operations Supplier Booking" });
    expect(within(panel).getByRole("button", { name: "Send revision to PMCM" })).toBeTruthy();
  });
});
