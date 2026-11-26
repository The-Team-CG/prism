import { describe, expect, it } from "vitest";
import { resolveMobileBar } from "@prism/ui";
import { navIconDrift, phoneBarIconClashes } from "@prism/ui/nav-icons";
import { eventPortalNavItems, pmcmMobileBar } from "./use-event-dashboard-nav";

const labels = (items: { label: string; shortLabel?: string }[]) => items.map((item) => item.shortLabel ?? item.label);

describe("PMCM phone bar", () => {
  it("on the desk keeps Inbox, Events, Inquiries and Calendar, with notifications on top and the rest under More", () => {
    const bar = resolveMobileBar(pmcmMobileBar(false), eventPortalNavItems({ inEventWorkspace: false }));

    expect(labels(bar.tabs)).toEqual(["Inbox", "Events", "Inquiries", "Calendar"]);
    expect(bar.header.map((item) => item.id)).toEqual(["notifications"]);
    expect(bar.more.map((item) => item.label)).toEqual(["Clients", "Suppliers", "Team", "Finance", "Receipts", "Payment details", "Audit", "Privacy", "Settings"]);
  });

  it("inside an event keeps Overview, Planning, Suppliers and Live, with the way back to all events under More", () => {
    const bar = resolveMobileBar(pmcmMobileBar(true), eventPortalNavItems({ inEventWorkspace: true }));

    expect(labels(bar.tabs)).toEqual(["Overview", "Planning", "Suppliers", "Live"]);
    expect(bar.header.map((item) => item.id)).toEqual(["event-messages"]);
    expect(bar.more.map((item) => item.label)).toEqual(["Floorplans", "Team & roles", "Billing", "Files", "Registration & games", "Post-event", "All events", "Inbox"]);
  });
});

describe("PMCM nav icons", () => {
  it("draws each shared idea with the icon every portal uses, and no two things in one bar alike", () => {
    for (const inEventWorkspace of [false, true]) {
      const nav = eventPortalNavItems({ inEventWorkspace });

      expect(navIconDrift(nav)).toEqual([]);
      expect(phoneBarIconClashes(resolveMobileBar(pmcmMobileBar(inEventWorkspace), nav))).toEqual([]);
    }
  });
});
