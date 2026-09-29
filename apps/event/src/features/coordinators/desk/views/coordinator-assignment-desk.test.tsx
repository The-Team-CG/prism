/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoordinatorAssignmentDesk } from "./coordinator-assignment-desk";

describe("CoordinatorAssignmentDesk availability conflicts", () => {
  it("warns PMCM when an assigned coordinator is unavailable on the event date", async () => {
    const availability = [{
      id: "availability_1",
      coordinatorId: "coord_1",
      startsAt: "2026-10-01T13:00:00.000Z",
      endsAt: "2026-10-01T17:00:00.000Z",
      kind: "unavailable",
      note: "Personal leave",
      declaredBy: "PMCM Admin",
      createdAt: "2026-09-01T00:00:00.000Z",
    }];
    render(
      <CoordinatorAssignmentDesk
        event={{ id: "evt_1", eventDate: "2026-10-01" } as never}
        coordinators={[{ id: "coord_1", name: "Jordan Lee", email: "jordan@example.test", active: true, roleTags: ["Floor Director"], skillsTags: [] } as never]}
        assignments={[{ id: "assignment_1", eventId: "evt_1", coordinatorId: "coord_1", coordinatorName: "Jordan Lee", role: "Floor Director", status: "acknowledged", eventDate: "2026-10-01" } as never]}
        roleRequirements={[]}
        busy={false}
        onAssign={vi.fn(async () => {})}
        onSaveCoverage={vi.fn(async () => true)}
        onSendReminders={vi.fn(async () => true)}
        onDesignateOperator={vi.fn(async () => {})}
        onLoadAvailability={vi.fn(async () => availability)}
        onCreateAvailability={vi.fn(async () => {})}
        onDeleteAvailability={vi.fn(async () => {})}
      />,
    );

    fireEvent.change(screen.getByLabelText("Coordinator availability"), { target: { value: "coord_1" } });

    expect(await screen.findByText(/unavailable date overlaps this event assignment/i)).toBeTruthy();
  });
});
