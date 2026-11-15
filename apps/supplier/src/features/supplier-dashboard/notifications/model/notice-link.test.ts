import { describe, expect, it } from "vitest";
import { supplierNoticeLink } from "./notice-link";

describe("supplierNoticeLink", () => {
  it("opens the booking for a schedule revision and Files for a file requirement", () => {
    expect(supplierNoticeLink({ kind: "supplier_schedule", requestId: "booking", revision: 2 })).toEqual({ href: "/dashboard/bookings#supplier-work-booking", label: "Review schedule revision 2" });
    expect(supplierNoticeLink({ kind: "event_section", eventId: "evt_1", section: "files" })).toEqual({ href: "/dashboard/files", label: "Open files" });
  });

  it("opens the conversation a message notice is about", () => {
    expect(supplierNoticeLink({ kind: "conversation", eventId: "evt_1", threadId: "thread_1" })).toEqual({ href: "/dashboard/messages#conversation-thread_1", label: "Open conversation" });
  });

  it("opens Payments for money PMCM sent, and gives suppliers no link into the client's floor plans", () => {
    expect(supplierNoticeLink({ kind: "event_section", eventId: "evt_1", section: "billing" })).toEqual({ href: "/dashboard/payments", label: "Open payments" });
    expect(supplierNoticeLink({ kind: "event_section", eventId: "evt_1", section: "floorplans" })).toBeNull();
    expect(supplierNoticeLink({ kind: "payment_receipt", receiptId: "prcp_1" })).toBeNull();
    expect(supplierNoticeLink(undefined)).toBeNull();
  });
});
