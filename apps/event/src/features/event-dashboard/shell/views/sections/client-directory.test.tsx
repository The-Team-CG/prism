/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@prism/ui/components/tooltip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismEvent, PrismInquiry } from "@prism/types";
import type { ReactElement } from "react";
import { ClientDirectory, ClientDossier } from "./client-directory";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/clients",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const event = (id: string, eventName: string, eventDate: string, status = "planning") => ({ id, eventName, eventDate, status, archived: false, clientPortalStatus: "unlocked" }) as PrismEvent;
const inquiry = (id: string, eventName: string, eventDate: string, status = "accepted", createdAt = `${eventDate}T00:00:00.000Z`) =>
  ({ id, eventName, eventDate, clientName: "Ana Cruz", email: "ana@acme.test", status, createdAt }) as PrismInquiry;

const client = {
  id: "acme",
  name: "Acme",
  contact: "Ana Cruz",
  events: [event("evt-gala", "Founders gala", "2027-05-15"), event("evt-2024", "Summit 2024", "2024-03-02", "completed"), event("evt-2025", "Summit 2025", "2025-03-02", "completed")],
  inquiries: [
    inquiry("inq-1", "Founders gala", "2027-05-15"),
    inquiry("inq-new", "Awards night", "2027-10-08", "new", "2026-11-18T00:00:00.000Z"),
    inquiry("inq-old", "Old party", "2023-06-01", "declined"),
  ],
};

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-21T04:00:00.000Z")); });

/** The portal shell supplies the tooltip provider; the dossier needs it when rendered on its own. */
const renderDossier = (ui: ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("client profile", () => {
  it("leads with the client, what they owe and four figures, then Overview, History and Contacts", () => {
    renderDossier(<ClientDossier client={client} balance="₱5,294,000" view="overview" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Acme" })).toBeTruthy();
    expect(screen.getByText("balance due")).toBeTruthy();
    const figures = screen.getByLabelText("Client figures").textContent ?? "";
    expect(figures).toContain("Events with PMCM3");
    expect(figures).toContain("Completed2");
    const tabs = screen.getByRole("tablist", { name: "Client views" });
    expect(within(tabs).getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Overview", "History", "Contacts"]);
    expect(within(tabs).getByRole("tab", { name: "History" }).getAttribute("href")).toBe("/dashboard/clients/acme/history");
  });

  it("shows only what is active and the inquiries waiting on a decision on Overview", () => {
    const onOpenEvent = vi.fn();
    renderDossier(<ClientDossier client={client} balance="₱0" view="overview" onBack={vi.fn()} onOpenEvent={onOpenEvent} />);

    const active = screen.getByRole("heading", { name: /Active and upcoming/ }).closest("section") as HTMLElement;
    fireEvent.click(within(active).getByRole("link", { name: "Founders gala" }));
    expect(onOpenEvent).toHaveBeenCalledWith("evt-gala");
    expect(screen.queryByText("Summit 2024")).toBeNull();
    expect(within(screen.getByRole("heading", { name: /Open inquiries/ }).closest("section") as HTMLElement).getByText("Awards night")).toBeTruthy();
    expect(screen.getByRole("link", { name: /4 earlier events and inquiries in History/ })).toBeTruthy();
  });

  it("folds the rest of the history by year, newest first, in the portal date format", () => {
    renderDossier(<ClientDossier client={client} balance="₱0" view="history" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    const years = screen.getAllByRole("group").map((group) => group.querySelector("summary")?.textContent ?? "");
    expect(years[0]).toMatch(/^2027/);
    expect(years.some((year) => /^2024.*1 event/.test(year))).toBe(true);
    expect(screen.getByText(/Jun 1, 2023 · Source not recorded/)).toBeTruthy();
    expect(screen.queryByText(/2023-06-01/)).toBeNull();
  });

  it("lists contacts from the client's inquiries", () => {
    renderDossier(<ClientDossier client={client} balance="₱0" view="contacts" onBack={vi.fn()} onOpenEvent={vi.fn()} />);

    expect(screen.getByRole("link", { name: "ana@acme.test" }).getAttribute("href")).toBe("mailto:ana@acme.test");
  });
});

describe("client directory", () => {
  it("opens on active clients, says what each has brought, and switches to prospects", () => {
    const prospect = { id: "lumen", name: "Lumen", events: [], inquiries: [inquiry("inq-l", "Launch", "2027-01-01", "new")] };
    renderDossier(<ClientDirectory clients={[client, prospect]} balances={new Map([["acme", 5_294_000]])} onOpenClient={vi.fn()} />);

    expect(screen.getByRole("link", { name: "Acme" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Lumen" })).toBeNull();
    expect(screen.getByText("3 events · 1 in progress")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Prospects/ }));
    expect(screen.getByRole("link", { name: "Lumen" })).toBeTruthy();
  });
});
