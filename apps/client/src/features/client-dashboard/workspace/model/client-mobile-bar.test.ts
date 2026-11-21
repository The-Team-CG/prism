import { describe, expect, it } from "vitest";
import { resolveMobileBar } from "@prism/ui";
import { navIconDrift, phoneBarIconClashes } from "@prism/ui/nav-icons";
import type { PrismEvent } from "@prism/types";
import { CLIENT_EVENT_MOBILE_BAR, CLIENT_PORTAL_MOBILE_BAR, clientEventSidebarItems, clientOpenEventSidebarItems, clientPortalSidebarItems } from "./client-dashboard-navigation";

const upcoming = [
  { id: "evt_a", eventName: "Ayala Gala", eventDate: "2099-03-01", status: "planning", archived: false },
  { id: "evt_b", eventName: "Bonifacio Launch", eventDate: "2099-04-01", status: "planning", archived: false },
] as PrismEvent[];

const labels = (items: { label: string; shortLabel?: string }[]) => items.map((item) => item.shortLabel ?? item.label);

describe("client phone bars", () => {
  it("outside an event keeps Home, Events, Calendar and Billing, with files and upcoming events under More", () => {
    const nav = [...clientPortalSidebarItems(2), ...clientOpenEventSidebarItems(upcoming)];
    const bar = resolveMobileBar(CLIENT_PORTAL_MOBILE_BAR, nav);

    expect(labels(bar.tabs)).toEqual(["Home", "Events", "Calendar", "Billing"]);
    expect(bar.header.map((item) => item.id)).toEqual(["messages", "notifications"]);
    expect(bar.more.map((item) => item.label)).toEqual(["Files", "Ayala Gala", "Bonifacio Launch"]);
  });

  it("with one event drops the pages that event carries, so no tab or icon points nowhere", () => {
    const bar = resolveMobileBar(CLIENT_PORTAL_MOBILE_BAR, clientPortalSidebarItems(1));

    expect(labels(bar.tabs)).toEqual(["Home", "Events", "Calendar"]);
    expect(bar.header.map((item) => item.id)).toEqual(["notifications"]);
    expect(bar.more).toEqual([]);
  });

  it("inside an event keeps Overview, Planning, Proposal and Billing, with the rest of the workspace under More", () => {
    const bar = resolveMobileBar(CLIENT_EVENT_MOBILE_BAR, clientEventSidebarItems("evt_a", { actualEndedAt: "2099-03-02T00:00:00Z", archived: false }));

    expect(labels(bar.tabs)).toEqual(["Overview", "Planning", "Proposal", "Billing"]);
    expect(bar.header.map((item) => item.id)).toEqual(["event-messages"]);
    expect(bar.more.map((item) => item.label)).toEqual(["Briefing", "Guest access", "Floor plan", "Files", "Closeout & feedback"]);
  });
});

describe("client nav icons", () => {
  it("draws each shared idea with the icon every portal uses, and no two things in one bar alike", () => {
    const portal = [...clientPortalSidebarItems(2), ...clientOpenEventSidebarItems(upcoming)];
    const event = clientEventSidebarItems("evt_a", { actualEndedAt: "2099-03-02T00:00:00Z", archived: false });

    expect(navIconDrift([...portal, ...event])).toEqual([]);
    expect(phoneBarIconClashes(resolveMobileBar(CLIENT_PORTAL_MOBILE_BAR, portal))).toEqual([]);
    expect(phoneBarIconClashes(resolveMobileBar(CLIENT_EVENT_MOBILE_BAR, event))).toEqual([]);
  });
});
