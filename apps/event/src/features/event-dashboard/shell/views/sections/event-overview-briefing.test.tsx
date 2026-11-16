/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismDefenseReadiness, PrismEvent } from "@prism/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/events/evt_1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EventWorkspaceOverview } from "./event-overview";

const event = { id: "evt_1", eventName: "Ayala Summit", clientName: "Ayala", eventDate: "2099-06-18", status: "briefing", clientPortalStatus: "unlocked" } as PrismEvent;
const readiness = {
  overallStatus: "blocked",
  lifecycleStage: "briefing_proposal",
  score: 29,
  nextActions: [],
  summary: { briefingSubmitted: false },
} as unknown as PrismDefenseReadiness;

afterEach(() => cleanup());

const handlers = { onStartEventDay: () => undefined, onRunCompliance: () => undefined, onOpenTab: () => undefined };
const section = (name: string) => screen.getByRole("heading", { name }).closest("section") as HTMLElement;

describe("EventWorkspaceOverview at a glance", () => {
  it("says what waits on PMCM and for how long, whether the client is keeping up, what is coming, how each area stands, and why readiness is low", () => {
    const withReasons = { ...readiness, nextActions: [{ key: "floorplan", label: "Official floorplan", detail: "Approve the official PMCM layout.", status: "blocked", targetTab: "floorplans" }] } as unknown as PrismDefenseReadiness;
    render(
      <EventWorkspaceOverview
        event={event}
        readiness={withReasons}
        drafts={[]}
        quoteRequestCount={0}
        quoteCount={0}
        openCheckCount={0}
        canStartEventDay={false}
        busy={false}
        visitRequested
        glance={{
          todayKey: "2099-06-01",
          attention: { eventId: "evt_1", counts: { critical: 0, warning: 1, attention: 0, info: 0 }, total: 1, top: [
            { id: "pay", kind: "payment", severity: "warning", label: "Record the downpayment", description: "", status: "open", createdAt: "2099-05-26T02:00:00.000Z", href: "/dashboard/finance" },
          ] } as never,
          clientActivity: { eventId: "evt_1", lastActiveAt: "2099-05-27T02:00:00.000Z", unreadNotices: 2 },
          comingUp: [{ id: "q", kind: "quote_deadline", eventId: "evt_1", eventName: "Ayala Summit", date: "2099-06-05", detail: "XPERTO · Registration" }],
          shortcuts: { billing: 1, messages: 3 },
        }}
        {...handlers}
      />,
    );

    const needs = section("Needs you");
    expect(within(needs).getByText("Schedule the venue visit Ayala asked for")).toBeTruthy();
    expect(within(needs).getByRole("link", { name: "Record the downpayment" }).getAttribute("href")).toBe("/dashboard/finance");
    expect(within(needs).getByText("waiting 6 days")).toBeTruthy();
    expect(screen.getByText("Ayala last opened the portal 5 days ago · 2 notices unread")).toBeTruthy();
    expect(within(section("Coming up")).getByRole("link", { name: /XPERTO · Registration/ }).getAttribute("href")).toBe("/dashboard/events/evt_1/suppliers");
    expect(within(needs).getByRole("img", { name: "2 soon" })).toBeTruthy();
    const areas = section("Event areas");
    expect(within(areas).getByRole("link", { name: /Messagess*3 unread/ }).getAttribute("href")).toBe("/dashboard/events/evt_1/messages");
    expect(within(areas).getByRole("link", { name: /Billings*1 payment overdue/ })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Readiness 29%" })).toBeTruthy();
    expect(within(section("Readiness")).getByRole("link", { name: /Official floorplan/ }).getAttribute("href")).toBe("/dashboard/events/evt_1/floorplans");
  });
});

describe("EventWorkspaceOverview briefing", () => {
  it("never offers PMCM a way to submit the briefing, even while the client has not", () => {
    render(
      <EventWorkspaceOverview
        event={event}
        readiness={readiness}
        drafts={[]}
        quoteRequestCount={0}
        quoteCount={0}
        openCheckCount={0}
        canStartEventDay={false}
        busy={false}
        onStartEventDay={() => undefined}
        onRunCompliance={() => undefined}
        onOpenTab={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "Run compliance check" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /submit briefing|resubmit briefing/i })).toBeNull();
  });
});
