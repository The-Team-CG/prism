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
  acknowledgeAndRefreshRoleView,
  withdrawAndRefreshWorkspace,
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

describe("coordinator event selection", () => {
  it("switches to another assigned event and reloads only that event's role view", async () => {
    vi.mocked(loadCoordinatorRoleView).mockClear();
    const secondEvent = { ...EVENT, id: "evt_2", eventName: "Leadership Forum", eventDate: "2026-10-12", venue: "Harbor Hall" };
    const secondAssignment = { ...LIVE, id: "coord_asg_2", eventId: "evt_2", role: "Usher" };
    const { result } = renderHook(() => useCoordinatorViewModel({
      session: SESSION as never,
      state: { assignments: [LIVE, secondAssignment], events: [EVENT, secondEvent] } as never,
      onRefresh: async () => {},
    }));

    await waitFor(() => expect(result.current.event?.id).toBe("evt_1"));
    act(() => result.current.selectEvent("evt_2"));

    await waitFor(() => expect(result.current.event?.id).toBe("evt_2"));
    expect(result.current.assignment?.id).toBe("coord_asg_2");
    await waitFor(() => expect(loadCoordinatorRoleView).toHaveBeenCalledWith(SESSION, "evt_2"));
  });

  it("ignores a previous event response that arrives after the selected event response", async () => {
    let resolveFirst!: (value: never) => void;
    const firstResponse = new Promise<never>((resolve) => { resolveFirst = resolve; });
    vi.mocked(loadCoordinatorRoleView).mockReset();
    vi.mocked(loadCoordinatorRoleView).mockImplementation(async (_session, eventId) =>
      eventId === "evt_1" ? firstResponse : ({ role: "Usher" } as never),
    );
    const secondEvent = { ...EVENT, id: "evt_2", eventName: "Leadership Forum" };
    const secondAssignment = { ...LIVE, id: "coord_asg_2", eventId: "evt_2", role: "Usher" };
    const { result } = renderHook(() => useCoordinatorViewModel({
      session: SESSION as never,
      state: { assignments: [LIVE, secondAssignment], events: [EVENT, secondEvent] } as never,
      onRefresh: async () => {},
    }));

    await waitFor(() => expect(loadCoordinatorRoleView).toHaveBeenCalledWith(SESSION, "evt_1"));
    act(() => result.current.selectEvent("evt_2"));
    await waitFor(() => expect(result.current.roleView?.role).toBe("Usher"));

    await act(async () => { resolveFirst({ role: "Floor Director" } as never); });
    expect(result.current.roleView?.role).toBe("Usher");
    vi.mocked(loadCoordinatorRoleView).mockImplementation(async () => null as never);
  });
});

describe("archived coordinator event selection", () => {
  it("loads historical records, blocks actions, and restores actions after returning to a current event", async () => {
    vi.clearAllMocks();
    vi.mocked(loadCoordinatorRoleView).mockResolvedValue({ role: "Floor Director", assignment: LIVE } as never);
    const archivedEvent = { ...EVENT, id: "evt_archived", eventName: "Archived Forum", archived: true };
    const archivedAssignment = { ...LIVE, id: "asg_archived", eventId: archivedEvent.id };
    const { result } = renderHook(() => useCoordinatorViewModel({ session: SESSION as never,
      state: { events: [EVENT, archivedEvent], assignments: [LIVE, archivedAssignment] } as never, onRefresh: async () => {} }));
    act(() => result.current.selectEvent(archivedEvent.id));
    await waitFor(() => expect(loadCoordinatorRoleView).toHaveBeenCalledWith(SESSION, archivedEvent.id));
    expect(result.current.readOnly).toBe(true);
    expect(result.current.attendanceForm.canMark).toBe(false);
    act(() => result.current.taskForm.setTitle("Historic task"));
    await act(async () => {
      await result.current.taskForm.submit();
      await result.current.acknowledge();
      await result.current.withdraw();
      result.current.attendanceForm.mark("present");
    });
    expect(createTaskAndRefreshRoleView).not.toHaveBeenCalled();
    expect(acknowledgeAndRefreshRoleView).not.toHaveBeenCalled();
    expect(withdrawAndRefreshWorkspace).not.toHaveBeenCalled();
    expect(markAttendanceAndRefreshRoleView).not.toHaveBeenCalled();
    act(() => result.current.selectEvent(EVENT.id));
    await waitFor(() => {
      expect(result.current.readOnly).toBe(false);
      expect(result.current.status).toBe("success");
      expect(result.current.roleView?.assignment?.coordinatorName).toBe(SESSION.name);
    });
    await act(async () => result.current.taskForm.submit());
    expect(createTaskAndRefreshRoleView).toHaveBeenCalledWith(expect.objectContaining({ eventId: EVENT.id }));
  });
});
