import { describe, expect, it } from "vitest";
import { clientPmcmContact } from "./client-pmcm-contact";

const events = [
  { id: "evt_past", eventName: "Year-end party", eventDate: "2026-10-01" },
  { id: "evt_soon", eventName: "Tech Summit", eventDate: "2026-12-01" },
  { id: "evt_later", eventName: "Product Launch", eventDate: "2027-02-01" },
];

describe("clientPmcmContact", () => {
  it("names the coordinator of the soonest upcoming event, and how many of the client's events they coordinate", () => {
    const contact = clientPmcmContact([
      { eventId: "evt_later", coordinatorName: "Marco Santos" },
      { eventId: "evt_soon", coordinatorName: "Marco Santos" },
      { eventId: "evt_past", coordinatorName: "Ms. Mys" },
    ], events, "2026-11-18");
    expect(contact).toEqual({ name: "Marco Santos", detail: "Coordinates Tech Summit and 1 more" });
  });

  it("falls back to the latest past event, ignores events the client cannot see, and is null with nobody assigned", () => {
    expect(clientPmcmContact([
      { eventId: "evt_other_client", coordinatorName: "Someone Else" },
      { eventId: "evt_past", coordinatorName: "Ms. Mys" },
    ], events, "2026-11-18")).toEqual({ name: "Ms. Mys", detail: "Coordinates Year-end party" });
    expect(clientPmcmContact([], events, "2026-11-18")).toBeNull();
  });
});
