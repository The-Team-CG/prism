import { describe, expect, it } from "vitest";
import { clientNoticeLink } from "./notice-link";

describe("clientNoticeLink", () => {
  it("opens the client's own page for the event area a notice is about", () => {
    const hrefs = (["overview", "briefing", "proposal", "floorplans", "billing", "files", "changes"] as const)
      .map((section) => clientNoticeLink({ kind: "event_section", eventId: "evt_1", section })?.href);
    expect(hrefs).toEqual([
      "/dashboard/events/evt_1/overview", "/dashboard/events/evt_1/briefing", "/dashboard/events/evt_1/proposal", "/dashboard/events/evt_1/floor-plan",
      "/dashboard/events/evt_1/billing", "/dashboard/events/evt_1/documents", "/dashboard/events/evt_1/changes",
    ]);
    expect(clientNoticeLink({ kind: "event_section", eventId: "evt 1", section: "billing" })).toEqual({ href: "/dashboard/events/evt 1/billing", label: "Open billing" });
  });

  it("offers no link for event-day operations, supplier schedules or notices without an action", () => {
    expect(clientNoticeLink({ kind: "event_section", eventId: "evt_1", section: "live_ops" })).toBeNull();
    expect(clientNoticeLink({ kind: "supplier_schedule", requestId: "req_1", revision: 2 })).toBeNull();
    expect(clientNoticeLink(undefined)).toBeNull();
  });
});
