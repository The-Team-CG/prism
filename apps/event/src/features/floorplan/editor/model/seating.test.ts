import { describe, expect, it } from "vitest";
import type { PrismGuestRosterEntry, PrismSupplierQuoteRequest } from "@prism/types";
import { bookedSuppliers, seatingGuestsFromRoster } from "./seating";

describe("editor seating data", () => {
  it("offers only eligible, unwithdrawn roster guests, as the API's seating check accepts them", () => {
    const entry = (id: string, fields: Partial<PrismGuestRosterEntry>) =>
      ({ id, guestName: id, category: "Family", eligibility: "eligible", rsvp: "confirmed", dietary: "", withdrawnAt: null, ...fields }) as PrismGuestRosterEntry;
    const guests = seatingGuestsFromRoster([entry("ana", { dietary: "Vegetarian" }), entry("gone", { withdrawnAt: "2026-11-01" }), entry("held", { eligibility: "pending-review" })]);
    expect(guests).toEqual([{ id: "ana", name: "ana", group: "Family", rsvp: "confirmed", dietary: "Vegetarian" }]);
  });

  it("names each supplier with a selected quote on this event once", () => {
    const request = (id: string, fields: Partial<PrismSupplierQuoteRequest>) =>
      ({ id, eventId: "evt_1", supplierId: "sup_1", supplierName: "Lumen Lights", category: "AV", status: "selected", ...fields }) as PrismSupplierQuoteRequest;
    const requests = [request("r1", {}), request("r2", {}), request("r3", { status: "sent" }), request("r4", { eventId: "evt_2", supplierId: "sup_2" })];
    expect(bookedSuppliers(requests, "evt_1")).toEqual([{ id: "sup_1", name: "Lumen Lights", kind: "AV" }]);
  });
});
