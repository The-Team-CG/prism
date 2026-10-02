/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mocked so no request can leave during the test. The regression assertion is
// literally "this was never called".
vi.mock("../use-cases/coordinator-desk-actions", () => ({
  loadCoordinatorRoleView: vi.fn(async () => null),
  acknowledgeAndRefreshRoleView: vi.fn(async () => null),
  withdrawAndRefreshWorkspace: vi.fn(async () => undefined),
  createTaskAndRefreshRoleView: vi.fn(async () => null),
  createUrgentIssueAndRefreshRoleView: vi.fn(async () => null),
  requestTaskReassignmentAndRefreshRoleView: vi.fn(async () => null),
  markAttendanceAndRefreshRoleView: vi.fn(async () => null),
}));

import {
  createTaskAndRefreshRoleView,
  loadCoordinatorRoleView,
  markAttendanceAndRefreshRoleView,
} from "../use-cases/coordinator-desk-actions";
import { useCoordinatorViewModel } from "./use-coordinator-view-model";

const SESSION = { name: "Marco Santos", email: "marco@pmcm.test", role: "coordinator" };
const EVENT = { id: "evt_1", eventName: "Ayala Tech Summit", clientName: "Ana Reyes", eventDate: "2026-06-18" };

const LIVE = {
  id: "coord_asg_1",
  eventId: "evt_1",
  coordinatorName: "Marco Santos",
  role: "Floor Director",
  status: "acknowledged",
  attendanceStatus: "pending",
};
const REPLACED = { ...LIVE, status: "replaced", attendanceStatus: "replaced" };

function workspace(assignment: Record<string, unknown>) {
  return { assignments: [assignment], events: [EVENT] } as never;
}

function renderVm(assignment: Record<string, unknown>) {
  return renderHook(
    ({ asg }: { asg: Record<string, unknown> }) =>
      useCoordinatorViewModel({
        session: SESSION as never,
        state: workspace(asg),
        onRefresh: async () => {},
      }),
    { initialProps: { asg: assignment } },
  );
}

describe("EP-11-S03: pending Absent confirm must not survive a replacement", () => {
  beforeEach(() => {
    vi.mocked(markAttendanceAndRefreshRoleView).mockClear();
  });

  it("clears the pending confirm when the assignment becomes replaced", async () => {
    const { result, rerender } = renderVm(LIVE);

    act(() => result.current.attendanceForm.mark("absent"));
    await waitFor(() => expect(result.current.attendanceForm.pendingChoice).toBe("absent"));

    rerender({ asg: REPLACED });

    await waitFor(() => expect(result.current.attendanceForm.pendingChoice).toBeNull());
  });

  it("refuses to submit a pending confirm once the assignment is replaced", async () => {
    const { result, rerender } = renderVm(LIVE);

    act(() => result.current.attendanceForm.mark("absent"));
    await waitFor(() => expect(result.current.attendanceForm.pendingChoice).toBe("absent"));

    rerender({ asg: REPLACED });
    act(() => result.current.attendanceForm.confirm());

    expect(markAttendanceAndRefreshRoleView).not.toHaveBeenCalled();
  });
});

describe("legacy coordinator task creation", () => {
  it("keeps tasks in the coordinator's named queue when the saved role is unmapped", async () => {
    vi.mocked(loadCoordinatorRoleView).mockResolvedValue({
      role: "Volunteer Lead",
      assignment: { coordinatorName: "Marco Santos" },
    } as never);

    const { result } = renderVm({ ...LIVE, role: "Volunteer Lead" });
    await waitFor(() => expect(result.current.taskForm.assignToMeRequired).toBe(true));

    expect(result.current.taskForm.role).toBe("General Coordinator");
    expect(result.current.taskForm.roleOptions).toEqual(["General Coordinator"]);
    expect(result.current.taskForm.assignToMe).toBe(true);

    act(() => result.current.taskForm.setTitle("Check arrival desk"));
    await act(async () => result.current.taskForm.submit());

    expect(createTaskAndRefreshRoleView).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        assignedRole: "General Coordinator",
        ownerName: "Marco Santos",
      }),
    }));
  });
});
