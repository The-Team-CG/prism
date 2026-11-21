/** @vitest-environment jsdom */
import type { ReactElement } from "react";
import { cleanup, fireEvent, render as renderPlain, screen, within } from "@testing-library/react";
import { PortalQueryProvider } from "@prism/portal-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismCommandInboxItem, PrismEvent, PrismPmcmEventAttention } from "@prism/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/events",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EventRegister } from "./event-register";

/** Cards read their cover through the portal cache; none of these events has a chosen cover, so nothing is fetched. */
const render = (ui: ReactElement) => renderPlain(<PortalQueryProvider actorKey="mys@pmcm.test">{ui}</PortalQueryProvider>);

const events = [
  { id: "evt_a", eventName: "Ayala Summit", clientName: "Ayala", venue: "Makati", eventDate: "2026-11-23", status: "planning", archived: false },
  { id: "evt_b", eventName: "Bonifacio Gala", clientName: "BGC", eventDate: "2026-12-12", status: "planning", archived: false },
  { id: "evt_c", eventName: "Cruz Reunion", clientName: "Cruz", eventDate: "2026-10-01", status: "completed", archived: false },
] as PrismEvent[];

function item(id: string, severity: PrismCommandInboxItem["severity"], label: string): PrismCommandInboxItem {
  return { id, kind: "billing", severity, label, description: "", status: "open", eventId: "evt_a", href: `/dashboard/events/evt_a/billing#${id}` };
}

const ayala: PrismPmcmEventAttention = {
  eventId: "evt_a", counts: { critical: 1, warning: 3, attention: 0, info: 0 }, total: 4,
  top: [item("i1", "critical", "Client payment overdue"), item("i2", "warning", "Review client file"), item("i3", "warning", "Answer a billing dispute")],
};

const section = (name: RegExp) => screen.getByRole("heading", { name }).closest("section") as HTMLElement;

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-16T04:00:00.000Z")); });

describe("PMCM events as cards", () => {
  it("opens an event from its card title", () => {
    const onOpenEvent = vi.fn();
    render(<EventRegister events={events} onOpenEvent={onOpenEvent} />);
    const link = screen.getByRole("link", { name: "Ayala Summit" });
    expect(link.getAttribute("href")).toBe("/dashboard/events/evt_a/overview");
    fireEvent.click(link);
    expect(onOpenEvent).toHaveBeenCalledWith("evt_a");
  });

  it("draws a card for what is on in the next two weeks and one row for each later event", () => {
    const attention = new Map([["evt_a", ayala], ["evt_b", { ...ayala, eventId: "evt_b" }]]);
    const money = new Map([["evt_a", { billed: 865_000, paid: 100_000, checking: 100_000 }], ["evt_b", { billed: 400_000, paid: 200_000, checking: 0 }]]);
    const shortcuts = new Map([["evt_a", { billing: 0, files: 3, messages: 2 }]]);
    render(<EventRegister events={events} data={{ attention, money, shortcuts, viewCounts: { "/dashboard/events": 3 } }} onOpenEvent={() => undefined} />);
    expect(screen.getByRole("tab", { name: /^All events\s*3$/ })).toBeTruthy();

    // Ayala is in seven days: a full card with the Inbox's work as links.
    const near = section(/Next 14 days/);
    expect(within(near).getByRole("link", { name: "Ayala Summit" })).toBeTruthy();
    expect(within(near).getByRole("link", { name: "Client payment overdue" }).getAttribute("href")).toBe("/dashboard/events/evt_a/billing#i1");
    expect(within(near).getByText("in 7 days")).toBeTruthy();
    expect(within(near).getByText("₱100,000 of ₱865,000 paid")).toBeTruthy();
    expect(within(near).getByRole("link", { name: "Messages, 2 unread" }).getAttribute("href")).toBe("/dashboard/events/evt_a/messages");

    // Bonifacio is a month away: one row with its stage, the first thing waiting and how many more.
    const later = section(/Later/);
    expect(within(later).getByRole("link", { name: "Bonifacio Gala" }).getAttribute("href")).toBe("/dashboard/events/evt_b/overview");
    expect(within(later).getByText("Client payment overdue")).toBeTruthy();
    expect(within(later).getByText("+3")).toBeTruthy();
    expect(within(later).getByText("₱200,000 of ₱400,000 paid")).toBeTruthy();

    expect(within(section(/Done/)).getByRole("link", { name: "Cruz Reunion" })).toBeTruthy();
  });

  it("narrows the cards and rows to one stage", () => {
    const briefing = { ...events[1], id: "evt_d", eventName: "Dela Cruz Debut", clientPortalStatus: "unlocked" } as PrismEvent;
    const planning = { ...events[1], clientPortalStatus: "unlocked", proposalClientStatus: "approved" } as PrismEvent;
    render(<EventRegister events={[planning, briefing]} onOpenEvent={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: /Planning\s*1/ }));
    expect(screen.getByRole("link", { name: "Bonifacio Gala" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Dela Cruz Debut" })).toBeNull();
  });

  it("claims nothing about what is waiting until the Inbox read arrives", () => {
    render(<EventRegister events={events} onOpenEvent={() => undefined} />);
    expect(screen.queryByText("Nothing waiting on you")).toBeNull();
    expect(screen.queryByText("Nothing waiting")).toBeNull();
    expect(within(section(/Next 14 days/)).getByRole("link", { name: "Ayala Summit" })).toBeTruthy();
  });
});
