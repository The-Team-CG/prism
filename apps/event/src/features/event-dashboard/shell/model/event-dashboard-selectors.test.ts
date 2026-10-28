import { describe, expect, it } from "vitest";
import type { PrismEvent, PrismInquiry } from "@prism/types";
import {
  canStartEventDay,
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

  it("keeps a contact's events and inquiries in one record when the names differ", () => {
    const records = selectClientRecords(
      [
        event({ id: "e1", clientName: "Ana Reyes", inquiryId: "i1" }),
        event({ id: "e2", clientName: "Ana Reyes", inquiryId: "i2" }),
      ],
      [
        inquiry({ id: "i1", clientName: "Ana Reyes", companyName: "Ayala UAT", email: "ana@ayala.test", status: "accepted" }),
        inquiry({ id: "i2", clientName: "Ana Reyes", companyName: "Ayala UAT", email: "ANA@ayala.test", status: "accepted" }),
        inquiry({ id: "i3", clientName: "Ben Cruz", companyName: "Ayala UAT", email: "ben@ayala.test", status: "new" }),
      ],
    );
    expect(records.map((record) => [record.name, record.events.length, record.inquiries.length])).toEqual([
      ["Ayala UAT", 2, 2],
      ["Ayala UAT", 0, 1],
    ]);
    expect(new Set(records.map((record) => record.id)).size).toBe(2);
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

  it("supports past, archived, and unfiltered client views", () => {
    const records = selectClientRecords(
      [
        event({ id: "active", clientName: "Active Co", status: "planning" }),
        event({ id: "past", clientName: "Past Co", status: "closed" }),
        event({ id: "archived", clientName: "Archived Co", status: "completed", archived: true }),
      ],
      [inquiry({ id: "prospect", clientName: "Prospect", companyName: "Prospect Co", status: "new" })],
    );

    expect(selectClientRecordsForView(records, "past").map((r) => r.name)).toEqual([
      "Archived Co",
      "Past Co",
    ]);
    expect(selectClientRecordsForView(records, "archived").map((r) => r.name)).toEqual(["Archived Co"]);
    expect(selectClientRecordsForView(records, "all")).toHaveLength(4);
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
    expect(selectEventsForView(events, "ongoing").map((e) => e.id)).toEqual(["u"]);
    expect(selectEventsForView(events, "all")).toEqual(events);
  });
});

describe("canStartEventDay", () => {
  const ready = event({ id: "evt_ready", clientName: "Client", status: "briefing", clientPortalStatus: "unlocked", floorPlanStatus: "approved" });
  it.each([
    ["an unlocked event with an approved floorplan, whatever its planning status", ready, true],
    ["a locked portal (conforme not signed)", { ...ready, clientPortalStatus: "locked" as const }, false],
    ["an unapproved floorplan", { ...ready, floorPlanStatus: "draft" }, false],
    ["an event already on event day", { ...ready, status: "event_day" }, false],
    ["an event with a recorded actual end", { ...ready, actualEndedAt: "2026-09-08T22:00:00.000Z" }, false],
    ["an archived event", { ...ready, archived: true }, false],
    ["a cancelled event", { ...ready, status: "cancelled" }, false],
  ])("%s -> %s", (_label, candidate, expected) => {
    expect(canStartEventDay(candidate)).toBe(expected);
  });
});
