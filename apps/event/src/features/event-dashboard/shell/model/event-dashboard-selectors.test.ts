import { describe, expect, it } from "vitest";
import type { PrismEvent, PrismInquiry } from "@prism/types";
import {
  selectClientRecords,
  selectClientRecordsForView,
  selectEventsForView,
  selectUnreviewedInquiryCount,
} from "./event-dashboard-selectors";

function event(partial: Partial<PrismEvent> & Pick<PrismEvent, "id" | "clientName">): PrismEvent {
  return {
    eventName: partial.eventName ?? partial.id,
    eventDate: partial.eventDate ?? "2026-08-01",
    status: partial.status ?? "planning",
    archived: partial.archived ?? false,
    ...partial,
  } as PrismEvent;
}

function inquiry(
  partial: Partial<PrismInquiry> & Pick<PrismInquiry, "id" | "clientName">,
): PrismInquiry {
  return {
    companyName: partial.companyName,
    status: partial.status ?? "new",
    eventName: partial.eventName ?? "Event",
    eventDate: partial.eventDate ?? "2026-08-01",
    ...partial,
  } as PrismInquiry;
}

describe("event-dashboard-selectors", () => {
  it("counts unreviewed inquiries", () => {
    const inquiries = [
      inquiry({ id: "i1", clientName: "A", status: "new" }),
      inquiry({ id: "i2", clientName: "B", status: "accepted" }),
    ];
    expect(selectUnreviewedInquiryCount(inquiries)).toBe(1);
  });

  it("builds client records from events and inquiries", () => {
    const records = selectClientRecords(
      [event({ id: "e1", clientName: "Acme Corp" })],
      [inquiry({ id: "i1", clientName: "Jane", companyName: "Acme Corp", status: "new" })],
    );
    expect(records).toHaveLength(1);
    expect(records[0]?.events).toHaveLength(1);
    expect(records[0]?.inquiries).toHaveLength(1);
  });

  it("filters client records by view", () => {
    const records = selectClientRecords(
      [event({ id: "e1", clientName: "Active Co", status: "planning" })],
      [
        inquiry({ id: "i1", clientName: "Prospect", companyName: "Prospect Co", status: "new" }),
        inquiry({ id: "i2", clientName: "Active", companyName: "Active Co", status: "accepted" }),
      ],
    );
    expect(selectClientRecordsForView(records, "prospects").map((r) => r.name)).toEqual([
      "Prospect Co",
    ]);
    expect(selectClientRecordsForView(records, "active").map((r) => r.name)).toEqual(["Active Co"]);
  });

  it("filters events by list view", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const events = [
      event({ id: "u", clientName: "A", eventDate: future, status: "planning" }),
      event({ id: "c", clientName: "B", eventDate: past, status: "completed" }),
      event({ id: "x", clientName: "C", eventDate: past, status: "cancelled" }),
      event({ id: "d", clientName: "D", eventDate: future, status: "draft" }),
    ];
    expect(selectEventsForView(events, "upcoming").map((e) => e.id)).toEqual(["u", "d"]);
    expect(selectEventsForView(events, "completed").map((e) => e.id)).toEqual(["c"]);
    expect(selectEventsForView(events, "cancelled").map((e) => e.id)).toEqual(["x"]);
    expect(selectEventsForView(events, "draft").map((e) => e.id)).toEqual(["d"]);
  });
});
