/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismEvent, PrismInquiry } from "@prism/types";
import { ClientDossier } from "./client-directory";

const client = {
  id: "acme",
  name: "Acme",
  contact: "Ana Cruz",
  events: [{ id: "evt-gala", eventName: "Founders gala", eventDate: "2027-05-15", status: "planning" } as PrismEvent],
  inquiries: [{ id: "inq-1", eventName: "Founders gala", eventDate: "2027-05-15", clientName: "Ana Cruz", email: "ana@acme.test", status: "accepted" } as PrismInquiry],
};

afterEach(cleanup);

describe("client dossier subviews", () => {
  it("reaches every dossier view from a tab strip, marking the current one", () => {
    render(<ClientDossier client={client} balance="₱0" view="invoices" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    const tabs = screen.getByRole("navigation", { name: "Client views" });
    expect(within(tabs).getAllByRole("link")).toHaveLength(9);
    expect(within(tabs).getByRole("link", { name: "Invoices" }).getAttribute("aria-current")).toBe("page");
    expect(within(tabs).getByRole("link", { name: "Contacts" }).getAttribute("aria-current")).toBeNull();
    expect(within(tabs).getByRole("link", { name: "Overview" }).getAttribute("href")).toBe("/dashboard/clients/acme");
    expect(within(tabs).getByRole("link", { name: "Activity log" }).getAttribute("href")).toBe("/dashboard/clients/acme/activity-log");
  });

  it("shows inquiry dates in the portal date format rather than ISO", () => {
    render(<ClientDossier client={client} balance="₱0" view="overview" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByText(/May 15, 2027 · Source not recorded/)).toBeTruthy();
    expect(screen.queryByText(/2027-05-15/)).toBeNull();
  });

  it("opens each event's own section from a per-event dossier view", () => {
    const onOpenEvent = vi.fn();
    render(<ClientDossier client={client} balance="₱0" view="invoices" onBack={vi.fn()} onOpenEvent={onOpenEvent} />);

    expect(screen.getByRole("heading", { name: "Invoices" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Inquiries" })).toBeNull();
    const open = screen.getByRole("link", { name: /Open invoices/ });
    expect(open.getAttribute("href")).toBe("/dashboard/events/evt-gala/billing");
    fireEvent.click(open);
    expect(onOpenEvent).toHaveBeenCalledWith("evt-gala", "billing");
  });

  it("says plainly when a view has no records instead of repeating the overview", () => {
    render(<ClientDossier client={client} balance="₱0" view="notes" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByText(/Client notes aren't recorded in P.R.I.S.M yet/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Events" })).toBeNull();
  });

  it("lists contacts from the client's inquiries", () => {
    render(<ClientDossier client={client} balance="₱0" view="contacts" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByRole("link", { name: "ana@acme.test" }).getAttribute("href")).toBe("mailto:ana@acme.test");
  });
});
