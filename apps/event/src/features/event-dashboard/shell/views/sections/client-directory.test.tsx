/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@prism/ui/components/tooltip";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismEvent, PrismInquiry } from "@prism/types";
import type { ReactElement } from "react";
import { ClientDossier } from "./client-directory";

const client = {
  id: "acme",
  name: "Acme",
  contact: "Ana Cruz",
  events: [{ id: "evt-gala", eventName: "Founders gala", eventDate: "2027-05-15", status: "planning" } as PrismEvent],
  inquiries: [{ id: "inq-1", eventName: "Founders gala", eventDate: "2027-05-15", clientName: "Ana Cruz", email: "ana@acme.test", status: "accepted" } as PrismInquiry],
};

afterEach(cleanup);

/** The portal shell supplies the tooltip provider; the dossier needs it when rendered on its own. */
const renderDossier = (ui: ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("client dossier subviews", () => {
  it("reaches every dossier view from a tab strip, marking the current one", () => {
    renderDossier(<ClientDossier client={client} balance="₱0" view="contacts" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    const tabs = screen.getByRole("tablist", { name: "Client views" });
    expect(within(tabs).getAllByRole("tab")).toHaveLength(3);
    expect(within(tabs).queryByRole("tab", { name: "Invoices" })).toBeNull();
    expect(within(tabs).getByRole("tab", { name: "Contacts" }).getAttribute("aria-selected")).toBe("true");
    expect(within(tabs).getByRole("tab", { name: "Overview" }).getAttribute("href")).toBe("/dashboard/clients/acme");
    expect(within(tabs).getByRole("tab", { name: "Events" }).getAttribute("href")).toBe("/dashboard/clients/acme/events");
  });

  it("shows inquiry dates in the portal date format rather than ISO", () => {
    renderDossier(<ClientDossier client={client} balance="₱0" view="overview" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByText(/May 15, 2027 · Source not recorded/)).toBeTruthy();
    expect(screen.queryByText(/2027-05-15/)).toBeNull();
  });

  it("opens each event's own section from a per-event dossier view", () => {
    const onOpenEvent = vi.fn();
    renderDossier(<ClientDossier client={client} balance="₱0" view="invoices" onBack={vi.fn()} onOpenEvent={onOpenEvent} />);

    expect(screen.getByRole("heading", { name: "Invoices" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Inquiries" })).toBeNull();
    const open = screen.getByRole("link", { name: /Open invoices/ });
    expect(open.getAttribute("href")).toBe("/dashboard/events/evt-gala/billing");
    fireEvent.click(open);
    expect(onOpenEvent).toHaveBeenCalledWith("evt-gala", "billing");
  });

  it("says plainly when a view has no records instead of repeating the overview", () => {
    renderDossier(<ClientDossier client={client} balance="₱0" view="notes" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByText(/Client notes aren't recorded in P.R.I.S.M yet/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Events" })).toBeNull();
  });

  it("lists contacts from the client's inquiries", () => {
    renderDossier(<ClientDossier client={client} balance="₱0" view="contacts" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByRole("link", { name: "ana@acme.test" }).getAttribute("href")).toBe("mailto:ana@acme.test");
  });
});
