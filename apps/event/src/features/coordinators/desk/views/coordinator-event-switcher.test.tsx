/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { CoordinatorEventSwitcher } from "./coordinator-event-switcher";

afterEach(cleanup);

const events = [
  { id: "evt_current", eventName: "Summit 2026", eventDate: "2026-10-04", venue: "Updated Hall" },
  { id: "evt_past", eventName: "Leadership Forum", eventDate: "2026-08-01", venue: "Historic Hall" },
  { id: "evt_unassigned", eventName: "Private Event", eventDate: "2026-10-12", venue: "Private Venue" },
] as PrismEvent[];

const assignments = [
  { id: "asg_current", eventId: "evt_current", coordinatorName: "Marco Santos", role: "Floor Director", status: "acknowledged" },
  { id: "asg_past", eventId: "evt_past", coordinatorName: "Marco Santos", role: "Usher", status: "acknowledged" },
  { id: "asg_inactive", eventId: "evt_unassigned", coordinatorName: "Marco Santos", role: "Usher", status: "replaced" },
] as PrismCoordinatorAssignment[];

describe("CoordinatorEventSwitcher", () => {
  it("opens an assigned past event and hides events without an active assignment", () => {
    const onSelect = vi.fn();
    render(
      <CoordinatorEventSwitcher
        events={events}
        assignments={assignments}
        selectedEventId="evt_current"
        onSelect={onSelect}
      />,
    );

    const pastEvent = screen.getByRole("button", { name: "Open Leadership Forum" });
    expect(screen.getByText("Venue: Historic Hall")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Private Event" })).toBeNull();
    fireEvent.click(pastEvent);

    expect(onSelect).toHaveBeenCalledWith("evt_past");
  });
});
