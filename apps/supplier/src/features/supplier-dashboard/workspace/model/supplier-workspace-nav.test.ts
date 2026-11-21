import { describe, expect, it } from "vitest";
import { resolveMobileBar } from "@prism/ui";
import { SUPPLIER_MOBILE_BAR, supplierNavItems } from "./supplier-workspace-nav";

describe("supplier phone bar", () => {
  it("keeps the day's work and the calendar as tabs, messages and notifications on top, and the rest under More", () => {
    const nav = supplierNavItems({ needsActionCount: 2, quoteNeedingSubmission: 1, handoffPending: 0, messagesUnread: 3 });
    const bar = resolveMobileBar(SUPPLIER_MOBILE_BAR, nav);

    expect(bar.tabs.map((tab) => tab.shortLabel ?? tab.label)).toEqual(["Today", "Requests", "Bookings", "Calendar"]);
    expect(bar.header.map((item) => item.id)).toEqual(["messages", "notifications"]);
    expect(bar.more.map((item) => item.label)).toEqual(["Files", "Payments", "Services & profile"]);
    expect(bar.tabs.length + bar.header.length + bar.more.length).toBe(nav.length);
  });
});
