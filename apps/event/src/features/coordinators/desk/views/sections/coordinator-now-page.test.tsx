/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorAssignment, PrismCoordinatorRoleView, PrismEvent } from "@prism/types";
import { COORDINATOR_ATTENDANCE_CHOICES } from "../../model/coordinators-desk-rules";
import { CoordinatorNowPage } from "./coordinator-now-page";
import type { CoordinatorAttendanceFormModel } from "./coordinator-role-sections";

vi.mock("@/features/coordinators/role-briefs/views/coordinator-role-brief-card", () => ({ CoordinatorRoleBriefCard: () => <p>Role brief</p> }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T10:00:00+08:00"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const event = { id: "evt_1", eventName: "Ayala Wedding", eventDate: "2026-11-20", clientName: "Ayala Corp", venue: "Garden Pavilion" } as PrismEvent;

function attendance(overrides: Partial<CoordinatorAttendanceFormModel> = {}): CoordinatorAttendanceFormModel {
  return {
    status: "pending", choices: COORDINATOR_ATTENDANCE_CHOICES, canMark: true, windowOpen: true, markedAt: null, hasAssignment: true, replaced: false,
    isDisabled: () => false, pendingChoice: null, pendingChoiceLabel: null, busy: false, error: null, mark: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), ...overrides,
  };
}

const roleView = {
  event,
  role: "General Coordinator",
  assignment: { id: "a1", eventId: "evt_1", coordinatorName: "Marco Santos", role: "General Coordinator", status: "acknowledged" },
  tasks: [
    { id: "t1", title: "Walk the garden", status: "open", priority: "normal", assignedRole: "General Coordinator", ownerName: "", notes: "", dueAt: "2026-11-20T12:45:00Z" },
    { id: "t2", title: "Cue the band", status: "in_progress", priority: "high", assignedRole: "General Coordinator", ownerName: "", notes: "", dueAt: "2026-11-20T12:15:00Z" },
  ],
  urgentIssues: [{ id: "i1", title: "Generator noise", status: "open", severity: "critical", affectedArea: "Garden", ownerRole: "", ownerName: "" }],
  supplierStatuses: [],
  coordinatorAssignments: [],
  guestAttendanceCount: 0,
  schedule: {
    eventId: "evt_1", authored: true, serverTime: "",
    days: [{ id: "d", eventId: "evt_1", dayDate: "2026-11-20", label: "Day", status: "active", segments: [
      { id: "s1", dayId: "d", sequence: 1, title: "First dance", plannedStartAt: "2026-11-20T12:00:00Z", plannedEndAt: "2026-11-20T12:20:00Z", ownerRole: "", location: "Main Hall", status: "active" },
      { id: "s2", dayId: "d", sequence: 2, title: "Toasts", plannedStartAt: "2026-11-20T12:30:00Z", plannedEndAt: "2026-11-20T12:50:00Z", ownerRole: "", location: "Stage", status: "planned" },
    ] }],
  },
  timer: { status: "active", label: "", segmentId: "s1", secondsRemaining: 522, serverTime: "" },
} as unknown as PrismCoordinatorRoleView;

function renderNow({ form = attendance(), assignment = { status: "acknowledged" } as Partial<PrismCoordinatorAssignment>, onNavigate = vi.fn() } = {}) {
  const taskActions = { busy: false, error: null, updateStatus: vi.fn(), blockTask: vi.fn(), unblockTask: vi.fn() };
  render(
    <CoordinatorNowPage
      event={event}
      assignment={{ id: "a1", eventId: "evt_1", coordinatorName: "Marco Santos", role: "General Coordinator", status: "acknowledged", doubleBookingWarning: false, ...assignment }}
      busy={false}
      roleView={roleView}
      roleViewLoading={false}
      roleViewError={null}
      attendanceForm={form}
      taskActions={taskActions}
      operatorActions={{} as never}
      onAcknowledge={vi.fn()}
      onDecline={vi.fn()}
      onWithdraw={vi.fn()}
      onNavigate={onNavigate}
    />,
  );
  return { taskActions, onNavigate };
}

describe("Now, on the event day", () => {
  it("shows what is on, how long is left and what follows", () => {
    renderNow();

    expect(screen.getByRole("heading", { name: "First dance" })).toBeTruthy();
    expect(screen.getByLabelText("8:42 left")).toBeTruthy();
    expect(screen.getByText(/Next at .* · Toasts · Stage/)).toBeTruthy();
  });

  it("marks arrival in one tap and keeps Late and Absent one step behind", () => {
    const form = attendance();
    renderNow({ form });

    expect(screen.queryByRole("button", { name: "Absent" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /I'm here/ }));
    expect(form.mark).toHaveBeenCalledWith("present");

    fireEvent.click(screen.getByRole("button", { name: "Late or absent?" }));
    expect(screen.getByRole("button", { name: "Absent" })).toBeTruthy();
  });

  it("shows a recorded arrival as one line instead of the buttons", () => {
    renderNow({ form: attendance({ status: "present", markedAt: "2026-11-20T09:42:00Z" }) });

    expect(screen.queryByRole("button", { name: /I'm here/ })).toBeNull();
    expect(screen.getByText("Marked Present at 5:42 PM")).toBeTruthy();
  });

  it("puts the task already started first, with its next step, and links to the issues", () => {
    const { taskActions, onNavigate } = renderNow();

    expect(screen.getByText("Cue the band")).toBeTruthy();
    expect(screen.queryByText("Walk the garden")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    expect(taskActions.updateStatus).toHaveBeenCalledWith("t2", "done");

    fireEvent.click(screen.getByRole("button", { name: /1 open issue/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("issues");
  });
});

describe("Now, before the event", () => {
  it("asks for an answer and opens the brief instead of the live panel", () => {
    vi.setSystemTime(new Date("2026-11-09T10:00:00+08:00"));
    renderNow({ assignment: { status: "assigned" }, form: attendance({ windowOpen: false, canMark: false }) });

    expect(screen.getByText("Your next event")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "11 days to go" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Ayala Wedding" })).toBeNull();
    expect(screen.getByRole("button", { name: "Confirm assignment" })).toBeTruthy();
    expect(screen.getByText("Role brief")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Directions to Garden Pavilion/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /I'm here/ })).toBeNull();
  });
});
