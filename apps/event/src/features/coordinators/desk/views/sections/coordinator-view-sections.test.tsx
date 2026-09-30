/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorRoleData } from "./coordinator-view-sections";

afterEach(cleanup);

const me = { id: "asg_me", eventId: "evt_1", coordinatorId: "coord_me", coordinatorName: "Marco Santos", role: "Floor Director", status: "acknowledged", attendanceStatus: "pending" };
const sam = { id: "asg_sam", eventId: "evt_1", coordinatorId: "coord_sam", coordinatorName: "Sam Cruz", role: "Stage Director", status: "acknowledged", attendanceStatus: "present" };
const riley = { id: "asg_riley", eventId: "evt_1", coordinatorId: "coord_riley", coordinatorName: "Riley Tan", role: "Usher", status: "replaced", attendanceStatus: "replaced" };
const ana = { id: "asg_ana", eventId: "evt_1", coordinatorId: "coord_ana", coordinatorName: "Ana Reyes", role: "Usher", status: "cancelled", attendanceStatus: "pending" };

const task = (overrides: Record<string, unknown>) => ({ id: "task", eventId: "evt_1", title: "Task", assignedRole: "Floor Director", ownerName: "", priority: "normal", status: "open", notes: "", ...overrides });
const supplier = (overrides: Record<string, unknown>) => ({ id: "req", eventId: "evt_1", supplierId: "sup", supplierName: "Supplier", category: "Catering", assignmentStatus: "confirmed", readinessStatus: "confirmed", eventDayStatus: "arrived", verificationStatus: "self_reported", ...overrides });

function roleView(overrides: Record<string, unknown> = {}) {
  return {
    event: { id: "evt_1", eventName: "Gala", clientName: "Client", eventDate: "2026-10-01" },
    briefing: null,
    role: "Floor Director",
    assignment: me,
    tasks: [],
    urgentIssues: [],
    supplierStatuses: [],
    coordinatorAssignments: [me],
    guestAttendanceCount: 0,
    guestCheckIns: [],
    isDesignatedOperator: false,
    canMarkDelegatedAttendance: false,
    taskReassignmentRequests: [],
    ...overrides,
  };
}

function renderRoleData(view: Record<string, unknown>, actions: { operator?: Record<string, unknown> } = {}) {
  const models = {
    taskForm: { title: "", setTitle: vi.fn(), role: "Floor Director", setRole: vi.fn(), priority: "normal", setPriority: vi.fn(), notes: "", setNotes: vi.fn(), dueAt: "", setDueAt: vi.fn(), assignToMe: false, setAssignToMe: vi.fn(), roleOptions: ["Floor Director"], routesAway: false, busy: false, error: null, submit: vi.fn() },
    issueForm: { title: "", setTitle: vi.fn(), severity: "high", setSeverity: vi.fn(), affectedArea: "", setAffectedArea: vi.fn(), description: "", setDescription: vi.fn(), slaDueAt: "", setSlaDueAt: vi.fn(), assignToMe: false, setAssignToMe: vi.fn(), busy: false, error: null, submit: vi.fn() },
    reassignment: { busy: false, error: null, request: vi.fn() },
    taskActions: { busy: false, error: null, updateStatus: vi.fn() },
    operatorActions: { busy: false, error: null, supplierBusy: false, supplierError: null, updateAttendance: vi.fn(), verifySupplier: vi.fn(), ...actions.operator },
  };
  const props = { roleViewLoading: false, roleViewError: null, roleView: view, registrationRole: false, ...models };
  render(<CoordinatorRoleData {...(props as unknown as ComponentProps<typeof CoordinatorRoleData>)} />);
  return models;
}

// Sam's attendance row reads "Sam Cruz · Stage Director · present"; the reassignment picker lists "Sam Cruz · Stage Director" too.
const samRow = () => screen.getByText(/Sam Cruz · Stage Director · present/).closest("div.rounded-lg") as HTMLElement;

describe("coordinator role queue", () => {
  it("offers Start only on tasks this coordinator is allowed to update", () => {
    const models = renderRoleData(roleView({
      tasks: [
        task({ id: "own", title: "Stage cue check" }),
        task({ id: "colleague", title: "Aisle sweep", ownerName: "Taylor Reyes" }),
        task({ id: "general", title: "Bin run", assignedRole: "General Coordinator" }),
      ],
    }));

    const start = screen.getAllByRole("button", { name: "Start" });
    expect(start).toHaveLength(1);
    fireEvent.click(start[0]);
    expect(models.taskActions.updateStatus).toHaveBeenCalledWith("own", "in_progress");
  });

  it("moves an in-progress task to done and lets a finished one be reopened", () => {
    const models = renderRoleData(roleView({ tasks: [task({ id: "running", title: "Doors", status: "in_progress" }), task({ id: "finished", title: "Load-in", status: "done" })] }));

    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));

    expect(models.taskActions.updateStatus).toHaveBeenNthCalledWith(1, "running", "done");
    expect(models.taskActions.updateStatus).toHaveBeenNthCalledWith(2, "finished", "open");
  });
});

describe("Event Day System Operator controls", () => {
  const operatorView = (overrides: Record<string, unknown> = {}) => roleView({
    isDesignatedOperator: true,
    coordinatorAssignments: [me, sam, riley, ana],
    tasks: [task({ id: "cue", title: "Stage cue check" })],
    ...overrides,
  });

  it("marks attendance only for coordinators still working the event", () => {
    renderRoleData(operatorView());

    expect(samRow()).toBeTruthy();
    expect(screen.queryByText(/Riley Tan/)).toBeNull();
    expect(screen.queryByText(/Ana Reyes/)).toBeNull();
    expect(within(samRow()).getByRole("button", { name: "Present" }).hasAttribute("disabled")).toBe(true);
  });

  it("records late arrivals straight away but asks before recording an absence", () => {
    const models = renderRoleData(operatorView());
    const row = within(samRow());

    fireEvent.click(row.getByRole("button", { name: "Late Arrival" }));
    expect(models.operatorActions.updateAttendance).toHaveBeenCalledWith("asg_sam", "late");

    fireEvent.click(row.getByRole("button", { name: "Absent" }));
    expect(models.operatorActions.updateAttendance).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Mark Sam Cruz absent\?/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm absent" }));
    expect(models.operatorActions.updateAttendance).toHaveBeenLastCalledWith("asg_sam", "absent");
    expect(screen.queryByText(/Mark Sam Cruz absent\?/)).toBeNull();
  });

  it("drops the absence prompt without recording anything when the operator keeps the status", () => {
    const models = renderRoleData(operatorView());

    fireEvent.click(within(samRow()).getByRole("button", { name: "Absent" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep as is" }));

    expect(models.operatorActions.updateAttendance).not.toHaveBeenCalled();
    expect(screen.queryByText(/Mark Sam Cruz absent\?/)).toBeNull();
  });

  it("requests a reassignment from the event roster without any browser prompt", () => {
    const prompt = vi.spyOn(window, "prompt");
    const models = renderRoleData(operatorView());

    fireEvent.change(screen.getByLabelText("Task to reassign"), { target: { value: "cue" } });
    fireEvent.change(screen.getByLabelText("New owner role"), { target: { value: "Stage Director" } });
    const owners = within(screen.getByLabelText("New owner coordinator")).getAllByRole("option").map((option) => option.textContent);
    expect(owners).toEqual(["Any coordinator in this role", "Sam Cruz · Stage Director"]);
    fireEvent.change(screen.getByLabelText("New owner coordinator"), { target: { value: "Sam Cruz" } });
    fireEvent.change(screen.getByLabelText("Reassignment reason"), { target: { value: "Marco is on the floor" } });
    fireEvent.click(screen.getByRole("button", { name: "Request reassignment" }));

    expect(models.reassignment.request).toHaveBeenCalledWith("cue", { toOwnerRole: "Stage Director", toOwnerName: "Sam Cruz", reason: "Marco is on the floor" });
    expect(prompt).not.toHaveBeenCalled();
    prompt.mockRestore();
  });

  it("can check supplier setup even when the operator is not on ingress", () => {
    renderRoleData(operatorView({ supplierStatuses: [supplier({ id: "req_1", supplierName: "Harvest Table" })] }));

    expect(screen.getByText(/Harvest Table/)).toBeTruthy();
  });
});

describe("supplier setup checks", () => {
  const ingressView = (overrides: Record<string, unknown> = {}) => roleView({
    role: "Egress Lead",
    assignment: { ...me, role: "Egress Lead" },
    supplierStatuses: [
      supplier({ id: "req_ok", supplierName: "Harvest Table" }),
      supplier({ id: "req_pending", supplierName: "Pending Florals", assignmentStatus: "pending_confirmation" }),
      supplier({ id: "req_out", supplierName: "Withdrawn Sound", assignmentStatus: "withdrawn" }),
    ],
    ...overrides,
  });

  it("lists only confirmed suppliers to an egress coordinator and passes their note with a dispute", () => {
    const models = renderRoleData(ingressView());

    expect(screen.getByText(/Harvest Table/)).toBeTruthy();
    expect(screen.queryByText(/Pending Florals/)).toBeNull();
    expect(screen.queryByText(/Withdrawn Sound/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Note for PMCM (optional)"), { target: { value: "Generator not running" } });
    fireEvent.click(screen.getByRole("button", { name: "Dispute" }));

    expect(models.operatorActions.verifySupplier).toHaveBeenCalledWith("req_ok", "disputed", "Generator not running");
    expect((screen.getByLabelText("Note for PMCM (optional)") as HTMLInputElement).value).toBe("");
  });

  it("shows a failed check to a coordinator who is not the operator", () => {
    renderRoleData(ingressView(), { operator: { supplierError: "Unable to update supplier setup status." } });

    expect(screen.getByRole("alert").textContent).toBe("Unable to update supplier setup status.");
  });

  it("gives other roles no supplier checks", () => {
    renderRoleData(roleView({ supplierStatuses: [supplier({ id: "req_ok", supplierName: "Harvest Table" })] }));

    expect(screen.queryByText(/Supplier setup checks/)).toBeNull();
  });
});
