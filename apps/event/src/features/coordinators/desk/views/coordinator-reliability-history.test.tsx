/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorReliabilityHistory } from "./coordinator-reliability-history";

afterEach(cleanup);

const entry = {
  id: "note_1",
  eventId: "evt_1",
  eventName: "Autumn Forum",
  eventDate: "2026-10-04",
  assignmentId: "assignment_1",
  assignmentRole: "Registration Staff",
  note: "Jordan Lee withdrew from Registration Staff: Family emergency",
  severity: "warning",
  createdAt: "2026-10-01T12:00:00.000Z",
};

describe("CoordinatorReliabilityHistory", () => {
  it("loads and presents event, role, and withdrawal reason for a selected coordinator", async () => {
    const onLoad = vi.fn(async () => [entry]);
    render(
      <CoordinatorReliabilityHistory
        coordinators={[{ id: "coord_1", name: "Jordan Lee" }]}
        assignments={[]}
        onLoad={onLoad}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Coordinator reliability profile" }), { target: { value: "coord_1" } });
    fireEvent.click(screen.getByRole("button", { name: "Load history" }));

    expect(await screen.findByText(entry.note)).toBeTruthy();
    expect(screen.getByText("Autumn Forum")).toBeTruthy();
    expect(screen.getByText("Registration Staff · 2026-10-04")).toBeTruthy();
    expect(onLoad).toHaveBeenCalledWith("coord_1");
  });

  it("shows historical coordinators that are no longer in the active roster", () => {
    render(
      <CoordinatorReliabilityHistory
        coordinators={[]}
        assignments={[{ coordinatorId: "coord_past", coordinatorName: "Past Coordinator" }]}
        onLoad={vi.fn(async () => [])}
      />,
    );

    expect(screen.getByRole("option", { name: "Past Coordinator" })).toBeTruthy();
  });
});
