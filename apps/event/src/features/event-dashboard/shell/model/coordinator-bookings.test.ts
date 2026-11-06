import { describe, expect, it } from "vitest";
import type { PrismCoordinator, PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { coordinatorAvailabilityState, coordinatorBookingsByCoordinator } from "./coordinator-bookings";

const TODAY = "2026-11-02";

const events = [
  { id: "evt_ayala", eventName: "Ayala Tech Summit 2026", eventDate: "2026-06-18", archived: false },
  { id: "evt_fair", eventName: "Makati Trade Fair", eventDate: "2026-12-05", archived: false },
  { id: "evt_later", eventName: "Year-end gala", eventDate: "2026-12-20", archived: false },
  { id: "evt_archived", eventName: "Old gala", eventDate: "2026-12-01", archived: true },
] as PrismEvent[];

function assignment(id: string, coordinatorId: string, eventId: string, status = "acknowledged") {
  return { id, coordinatorId, eventId, role: "Floor Director", status } as PrismCoordinatorAssignment;
}

const marco = { id: "coord_marco", name: "Marco Santos", active: true } as PrismCoordinator;

describe("coordinator bookings for the Team roster", () => {
  it("reports a coordinator whose only assignment has passed as not booked ahead, with that last event", () => {
    const bookings = coordinatorBookingsByCoordinator([assignment("a1", "coord_marco", "evt_ayala")], events, TODAY);

    const state = coordinatorAvailabilityState(marco, bookings.get("coord_marco"));

    expect(state.kind).toBe("past");
    if (state.kind === "past") expect(state.last.event.eventName).toBe("Ayala Tech Summit 2026");
  });

  it("shows the soonest upcoming assignment and counts the others", () => {
    const bookings = coordinatorBookingsByCoordinator(
      [assignment("a1", "coord_marco", "evt_later"), assignment("a2", "coord_marco", "evt_fair"), assignment("a3", "coord_marco", "evt_ayala")],
      events,
      TODAY,
    );

    const state = coordinatorAvailabilityState(marco, bookings.get("coord_marco"));

    expect(state).toMatchObject({ kind: "upcoming", more: 1, next: { event: { eventName: "Makati Trade Fair" } } });
  });

  it("does not count cancelled or replaced assignments as bookings", () => {
    const bookings = coordinatorBookingsByCoordinator([assignment("a1", "coord_marco", "evt_fair", "cancelled")], events, TODAY);

    expect(coordinatorAvailabilityState(marco, bookings.get("coord_marco")).kind).toBe("unassigned");
  });

  it("treats an archived event as history, never as an upcoming booking", () => {
    const bookings = coordinatorBookingsByCoordinator([assignment("a1", "coord_marco", "evt_archived")], events, TODAY);

    expect(coordinatorAvailabilityState(marco, bookings.get("coord_marco")).kind).toBe("past");
  });

  it("marks an inactive coordinator as not available, whatever their assignments", () => {
    const bookings = coordinatorBookingsByCoordinator([assignment("a1", "coord_marco", "evt_fair")], events, TODAY);

    expect(coordinatorAvailabilityState({ active: false }, bookings.get("coord_marco")).kind).toBe("inactive");
  });
});
