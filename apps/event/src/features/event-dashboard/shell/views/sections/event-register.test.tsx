/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismCommandInboxItem, PrismEvent, PrismPmcmEventAttention } from "@prism/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/events",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EventRegister } from "./event-register";

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

  it("puts an event the Inbox has work on first, listing that work as links, and says a clear event has nothing waiting", () => {
    const attention = new Map([["evt_a", ayala]]);
    const money = new Map([["evt_a", { billed: 865_000, paid: 100_000, checking: 100_000 }]]);
    const notes = new Map([["evt_b", ["2 unread messages"]]]);
    render(<EventRegister events={events} data={{ attention, money, notes }} onOpenEvent={() => undefined} />);

    const needsYou = section(/Needs you/);
    expect(within(needsYou).getByRole("link", { name: "Ayala Summit" })).toBeTruthy();
    expect(within(needsYou).getByRole("link", { name: "Client payment overdue" }).getAttribute("href")).toBe("/dashboard/events/evt_a/billing#i1");
    expect(within(needsYou).getByText("+1 more")).toBeTruthy();
    expect(within(needsYou).getByText("in 7 days")).toBeTruthy();
    expect(within(needsYou).getByText("₱100,000 of ₱865,000 paid")).toBeTruthy();

    const comingUp = section(/Coming up/);
    expect(within(comingUp).getByRole("link", { name: "Bonifacio Gala" })).toBeTruthy();
    expect(within(comingUp).getByText("Nothing waiting on you")).toBeTruthy();
    expect(within(comingUp).getByText("2 unread messages")).toBeTruthy();

    expect(within(section(/Done/)).getByRole("link", { name: "Cruz Reunion" })).toBeTruthy();
  });

  it("claims nothing about what is waiting until the Inbox read arrives", () => {
    render(<EventRegister events={events} onOpenEvent={() => undefined} />);
    expect(screen.queryByRole("heading", { name: /Needs you/ })).toBeNull();
    expect(screen.queryByText("Nothing waiting on you")).toBeNull();
    expect(within(section(/^Events/)).getByRole("link", { name: "Ayala Summit" })).toBeTruthy();
  });
});
