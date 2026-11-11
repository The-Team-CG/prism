import { describe, expect, it } from "vitest";
import { pmcmNoticeLink } from "./notice-link";

describe("pmcmNoticeLink", () => {
  it("opens the event workspace tab a notice is about", () => {
    expect(pmcmNoticeLink({ kind: "event_section", eventId: "evt_1", section: "billing" }, "evt_1")).toEqual({ href: "/dashboard/events/evt_1/billing", label: "Open billing" });
    expect(pmcmNoticeLink({ kind: "event_section", eventId: "evt_1", section: "files" }, null)).toEqual({ href: "/dashboard/events/evt_1/files", label: "Open files" });
    expect(pmcmNoticeLink({ kind: "event_section", eventId: "evt_1", section: "floorplans" }, null)).toEqual({ href: "/dashboard/events/evt_1/floorplans", label: "Open floorplans" });
  });

  it("sends a supplier schedule notice to the event's suppliers tab, and nowhere without an event", () => {
    const action = { kind: "supplier_schedule", requestId: "req_1", revision: 3 } as const;
    expect(pmcmNoticeLink(action, "evt_2")).toEqual({ href: "/dashboard/events/evt_2/suppliers", label: "Open suppliers" });
    expect(pmcmNoticeLink(action, null)).toBeNull();
    expect(pmcmNoticeLink(undefined, "evt_2")).toBeNull();
  });
});
