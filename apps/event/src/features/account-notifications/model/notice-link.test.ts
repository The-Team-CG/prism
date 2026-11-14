import { describe, expect, it } from "vitest";
import { pmcmNoticeLink } from "./notice-link";

describe("pmcmNoticeLink", () => {
  it("opens the event workspace tab a notice is about", () => {
    const hrefs = (["overview", "briefing", "proposal", "changes", "floorplans", "billing", "files", "live_ops"] as const)
      .map((section) => pmcmNoticeLink({ kind: "event_section", eventId: "evt_1", section }, null)?.href);
    expect(hrefs).toEqual([
      "/dashboard/events/evt_1/overview", "/dashboard/events/evt_1/briefing", "/dashboard/events/evt_1/briefing", "/dashboard/events/evt_1/briefing",
      "/dashboard/events/evt_1/floorplans", "/dashboard/events/evt_1/billing", "/dashboard/events/evt_1/files?part=required", "/dashboard/events/evt_1/live-ops",
    ]);
  });

  it("opens the conversation a message notice is about", () => {
    expect(pmcmNoticeLink({ kind: 'conversation', eventId: 'evt_1', threadId: 'thread_1' }, 'evt_1', 'coordinator')).toEqual({ href: '/dashboard?view=messages&conversation=thread_1', label: 'Open conversation' });
    expect(pmcmNoticeLink({ kind: "conversation", eventId: "evt_1", threadId: "thread_1" }, "evt_1")).toEqual({ href: "/dashboard/events/evt_1/messages#conversation-thread_1", label: "Open conversation" });
  });

  it("sends a supplier schedule notice to the event's suppliers tab, and nowhere without an event", () => {
    const action = { kind: "supplier_schedule", requestId: "req_1", revision: 3 } as const;
    expect(pmcmNoticeLink(action, "evt_2")).toEqual({ href: "/dashboard/events/evt_2/suppliers", label: "Open suppliers" });
    expect(pmcmNoticeLink(action, null)).toBeNull();
    expect(pmcmNoticeLink(undefined, "evt_2")).toBeNull();
  });
});
