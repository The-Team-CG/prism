import { describe, expect, it } from "vitest";
import { clientNoticeLink } from "./notice-link";

describe("clientNoticeLink", () => {
  it("opens the event section a notice points at, in the client's own routes", () => {
    expect(clientNoticeLink({ kind: "event_section", eventId: "evt 1", section: "billing" })).toEqual({ href: "/dashboard/events/evt 1/billing", label: "Open billing" });
    expect(clientNoticeLink({ kind: "event_section", eventId: "evt_1", section: "files" })).toEqual({ href: "/dashboard/events/evt_1/documents", label: "Open documents" });
    expect(clientNoticeLink({ kind: "event_section", eventId: "evt_1", section: "floorplans" })).toEqual({ href: "/dashboard/events/evt_1/floor-plan", label: "Open floor plan" });
  });

  it("offers no link for supplier schedules or notices without an action", () => {
    expect(clientNoticeLink({ kind: "supplier_schedule", requestId: "req_1", revision: 2 })).toBeNull();
    expect(clientNoticeLink(undefined)).toBeNull();
  });
});
