import { describe, expect, it } from "vitest";
import { pmcmNoticeLink } from "./notice-link";

describe("pmcmNoticeLink", () => {
  it("opens the event workspace tab a notice is about", () => {
    const hrefs = (["overview", "briefing", "proposal", "changes", "floorplans", "billing", "files", "live_ops"] as const)
      .map((section) => pmcmNoticeLink({ kind: "event_section", eventId: "evt_1", section }, null)?.href);
    expect(hrefs).toEqual([
      "/dashboard/events/evt_1/overview", "/dashboard/events/evt_1/briefing", "/dashboard/events/evt_1/briefing", "/dashboard/events/evt_1/briefing",
      "/dashboard/events/evt_1/floorplans", "/dashboard/events/evt_1/billing", "/dashboard/events/evt_1/files", "/dashboard/events/evt_1/live-ops",
    ]);
  });

  it("keeps a coordinator in their own portal: the shift and run sheet, and no link to a PMCM-only area", () => {
    const link = (section: "overview" | "briefing" | "live_ops" | "billing" | "files") => pmcmNoticeLink({ kind: "event_section", eventId: "evt 1", section }, "evt 1", "coordinator");
    expect(link("live_ops")).toEqual({ href: "/dashboard?view=run-sheet&event=evt+1", label: "Open run sheet" });
    expect(link("overview")).toEqual({ href: "/dashboard?view=shift&event=evt+1", label: "Open my shift" });
    expect(link("briefing")?.href).toBe("/dashboard?view=shift&event=evt+1");
    expect([link("billing"), link("files")]).toEqual([null, null]);
    expect(pmcmNoticeLink({ kind: "payment_receipt", receiptId: "prcp_1" }, "evt_1", "coordinator")).toBeNull();
    expect(pmcmNoticeLink({ kind: "supplier_schedule", requestId: "req_1", revision: 1 }, "evt_1", "coordinator")).toBeNull();
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

  it("opens a payment the client reported on the receipts desk, ready to check", () => {
    expect(pmcmNoticeLink({ kind: "payment_receipt", receiptId: "prcp_1" }, "evt_1")).toEqual({ href: "/dashboard/finance/receipts?receipt=prcp_1", label: "Check payment" });
  });
});
