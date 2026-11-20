/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorAssignment, PrismCoordinatorRoleView, PrismEvent } from "@prism/types";
import { CoordinatorShiftPage } from "./coordinator-shift-page";
import type { CoordinatorAttendanceFormModel } from "./coordinator-role-sections";

vi.mock("@/features/pmcm-overview", () => ({ useEventCoverUrl: () => undefined }));

afterEach(cleanup);

const event = { id: "evt_1", eventName: "Ayala Wedding", eventDate: "2026-11-20", clientName: "Ayala Corp", venue: "Grand Hall" } as PrismEvent;
const attendanceForm: CoordinatorAttendanceFormModel = {
  status: "pending", choices: [], canMark: false, windowOpen: true, markedAt: null, hasAssignment: true, replaced: false, isDisabled: () => true,
  pendingChoice: null, pendingChoiceLabel: null, busy: false, error: null, mark: vi.fn(), confirm: vi.fn(), cancel: vi.fn(),
};
const roleView = {
  tasks: [{ id: "t1", title: "Stage cue check", status: "open", assignedRole: "General Coordinator", ownerName: "", notes: "" }],
  urgentIssues: [{ id: "i1", title: "Generator down", status: "open", severity: "critical", affectedArea: "Main Hall", ownerRole: "", ownerName: "" }],
  supplierStatuses: [],
  guestAttendanceCount: 0,
} as unknown as PrismCoordinatorRoleView;

function renderShift(assignment: Partial<PrismCoordinatorAssignment>, onAcknowledge = vi.fn(), onNavigate = vi.fn()) {
  render(
    <CoordinatorShiftPage
      event={event}
      assignment={{ id: "a1", eventId: "evt_1", coordinatorName: "Marco Santos", role: "General Coordinator", status: "assigned", doubleBookingWarning: false, ...assignment }}
      roleName="General Coordinator"
      busy={false}
      roleView={roleView}
      roleViewLoading={false}
      roleViewError={null}
      registrationRole={false}
      attendanceForm={attendanceForm}
      onAcknowledge={onAcknowledge}
      onNavigate={onNavigate}
    />,
  );
  return { onAcknowledge, onNavigate };
}

describe("My shift", () => {
  it("asks for confirmation in the lead and confirms without passing the click event as the decision", () => {
    const { onAcknowledge } = renderShift({ status: "assigned" });

    fireEvent.click(screen.getByRole("button", { name: "Confirm assignment" }));

    expect(onAcknowledge).toHaveBeenCalledTimes(1);
    expect(onAcknowledge).toHaveBeenCalledWith();
  });

  it("shows a confirmed assignment with its attendance instead of the button", () => {
    renderShift({ status: "acknowledged", attendanceStatus: "late" });

    expect(screen.queryByRole("button", { name: "Confirm assignment" })).toBeNull();
    expect(screen.getByText("Confirmed with PMCM · Attendance: Late arrival")).toBeTruthy();
  });

  it("lists the critical issue ahead of the task, and each row opens its view", () => {
    const { onNavigate } = renderShift({ status: "acknowledged" });
    const list = within(screen.getByRole("region", { name: /Waiting on you/ }));
    const rows = list.getAllByRole("listitem");

    expect(rows[0].textContent).toContain("Generator down");
    expect(rows[1].textContent).toContain("Stage cue check");
    fireEvent.click(list.getByRole("button", { name: "Generator down" }));
    expect(onNavigate).toHaveBeenLastCalledWith("issues");
    fireEvent.click(list.getByRole("button", { name: "Stage cue check" }));
    expect(onNavigate).toHaveBeenLastCalledWith("tasks");
  });
});
