/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoordinatorAttendanceControl, CoordinatorRoleData, CoordinatorTaskSheet, type CoordinatorAttendanceFormModel, type CoordinatorTaskFormModel } from "./coordinator-role-sections";
import { canCheckSuppliers, CoordinatorSupplierChecks, type CoordinatorOperatorActionsModel } from "./coordinator-operator-sections";
import { COORDINATOR_ATTENDANCE_CHOICES } from "../../model/coordinators-desk-rules";
import { chooseSelectOption, openSelect } from "../../../../../test-utils/radix-select";

afterEach(cleanup);

// The role brief card loads its own briefs; keep it off the network so a late failure cannot land after teardown.
vi.mock("@/features/coordinators/role-briefs/data/role-briefs-repository", () => ({
  roleBriefsRepository: { list: vi.fn(async () => []), save: vi.fn() },
}));

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

function renderRoleData(view: Record<string, unknown>, actions: { operator?: Record<string, unknown>; taskTitle?: string; taskBlockedReason?: string } = {}, section: "tasks" | "issues" = "tasks") {
  const models = {
    taskForm: { blockedReason: actions.taskBlockedReason ?? null, title: actions.taskTitle ?? "", setTitle: vi.fn(), role: "Floor Director", setRole: vi.fn(), priority: "normal", setPriority: vi.fn(), notes: "", setNotes: vi.fn(), dueAt: "", setDueAt: vi.fn(), assignToMe: false, setAssignToMe: vi.fn(), roleOptions: ["Floor Director"], routesAway: false, busy: false, error: null, submit: vi.fn(async () => true) },
    reassignment: { busy: false, error: null, request: vi.fn() },
    taskActions: { busy: false, error: null, updateStatus: vi.fn(), blockTask: vi.fn(), unblockTask: vi.fn() },
    operatorActions: { busy: false, error: null, supplierBusy: false, supplierError: null, updateAttendance: vi.fn(), verifySupplier: vi.fn(), reportSupplierStatus: vi.fn(), ...actions.operator },
  };
  const props = { section, roleViewLoading: false, roleViewError: null, roleView: view, registrationRole: false, ...models };
  render(<CoordinatorRoleData {...(props as unknown as ComponentProps<typeof CoordinatorRoleData>)} />);
  return models;
}

/** Supplier check-ins as Now shows them to the operator and the ingress and egress coordinators. */
function renderSupplierChecks(view: Record<string, unknown>, operator: Record<string, unknown> = {}) {
  const actions = { busy: false, error: null, supplierBusy: false, supplierError: null, updateAttendance: vi.fn(), verifySupplier: vi.fn(), reportSupplierStatus: vi.fn(), ...operator };
  render(<CoordinatorSupplierChecks roleView={view as never} actions={actions as unknown as CoordinatorOperatorActionsModel} />);
  return { operatorActions: actions };
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

    fireEvent.click(row.getByRole("button", { name: "Late arrival" }));
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

    chooseSelectOption(screen.getByLabelText("Task to reassign"), "Stage cue check");
    chooseSelectOption(screen.getByLabelText("New owner role"), "Stage Director");
    openSelect(screen.getByLabelText("New owner coordinator"));
    const owners = within(screen.getByRole("listbox")).getAllByRole("option").map((option) => option.textContent);
    expect(owners).toEqual(["Any coordinator in this role", "Sam Cruz · Stage Director"]);
    fireEvent.click(screen.getByRole("option", { name: "Sam Cruz · Stage Director" }));
    fireEvent.change(screen.getByLabelText("Reassignment reason"), { target: { value: "Marco is on the floor" } });
    fireEvent.click(screen.getByRole("button", { name: "Request reassignment" }));

    expect(models.reassignment.request).toHaveBeenCalledWith("cue", { toOwnerRole: "Stage Director", toOwnerName: "Sam Cruz", reason: "Marco is on the floor" });
    expect(prompt).not.toHaveBeenCalled();
    prompt.mockRestore();
  });

  it("can check supplier setup even when the operator is not on ingress", () => {
    const view = operatorView({ supplierStatuses: [supplier({ id: "req_1", supplierName: "Harvest Table" })] });
    expect(canCheckSuppliers(view as never)).toBe(true);

    renderSupplierChecks(view);
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
    const models = renderSupplierChecks(ingressView());

    expect(screen.getByText(/Harvest Table/)).toBeTruthy();
    expect(screen.queryByText(/Pending Florals/)).toBeNull();
    expect(screen.queryByText(/Withdrawn Sound/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Note for PMCM (optional)"), { target: { value: "Generator not running" } });
    fireEvent.click(screen.getByRole("button", { name: "Dispute" }));

    expect(models.operatorActions.verifySupplier).toHaveBeenCalledWith("req_ok", "disputed", "Generator not running");
    expect((screen.getByLabelText("Note for PMCM (optional)") as HTMLInputElement).value).toBe("");
  });

  it("offers each confirmed supplier only its next on-site step and passes the note with it", () => {
    const models = renderSupplierChecks(ingressView({
      supplierStatuses: [
        supplier({ id: "req_new", supplierName: "Harvest Table", eventDayStatus: "not_started" }),
        supplier({ id: "req_set", supplierName: "Sound Co", eventDayStatus: "set_up_ready" }),
        supplier({ id: "req_done", supplierName: "Florals", eventDayStatus: "done_leaving" }),
        supplier({ id: "req_unready", supplierName: "Lights", eventDayStatus: "not_started", readinessStatus: "pending" }),
      ],
    }));

    expect(screen.getAllByRole("button", { name: /^Mark / }).map((button) => button.textContent)).toEqual(["Mark arrived", "Mark done and leaving"]);

    fireEvent.change(screen.getByLabelText("Note for PMCM (optional)"), { target: { value: "Truck at dock 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark arrived" }));

    expect(models.operatorActions.reportSupplierStatus).toHaveBeenCalledWith("req_new", "arrived", "Truck at dock 2");
  });

  it("shows a failed check to a coordinator who is not the operator", () => {
    renderSupplierChecks(ingressView(), { supplierError: "Unable to update supplier setup status." });

    expect(screen.getByRole("alert").textContent).toBe("Unable to update supplier setup status.");
  });

  it("gives other roles no supplier checks", () => {
    expect(canCheckSuppliers(roleView({ supplierStatuses: [supplier({ id: "req_ok", supplierName: "Harvest Table" })] }) as never)).toBe(false);
  });
});

function attendanceModel(overrides: Partial<CoordinatorAttendanceFormModel> = {}): CoordinatorAttendanceFormModel {
  const status = overrides.status ?? "pending";
  const canMark = overrides.canMark ?? true;
  return {
    status,
    choices: COORDINATOR_ATTENDANCE_CHOICES,
    canMark,
    windowOpen: true,
    markedAt: null,
    hasAssignment: true,
    replaced: false,
    isDisabled: (choice) => !canMark || choice === status,
    pendingChoice: null,
    pendingChoiceLabel: null,
    busy: false,
    error: null,
    mark: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function renderAttendance(attendanceForm: CoordinatorAttendanceFormModel) {
  render(<CoordinatorAttendanceControl attendanceForm={attendanceForm} />);
}

describe("coordinator self-attendance window", () => {
  it("offers the marks while the event window is open and shows the pressed state with the mark time", () => {
    const mark = vi.fn();
    // 10:42 UTC is 6:42 PM in Manila; the time shown must be the Philippine time.
    renderAttendance(attendanceModel({ status: "late", markedAt: "2026-06-18T10:42:00Z", mark }));

    expect(screen.getByRole("button", { name: "Late arrival" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Present" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Marked Late arrival at 6:42 PM")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Present" }));
  });

  it("replaces the marks with the recorded status as text once the window has closed", () => {
    renderAttendance(attendanceModel({ status: "present", windowOpen: false, canMark: false, markedAt: "2026-06-18T10:42:00Z" }));

    expect(screen.getByText("Marked Present.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Absent" })).toBeNull();
  });

  it("tells the coordinator to contact PMCM when a closed window never recorded attendance", () => {
    renderAttendance(attendanceModel({ windowOpen: false, canMark: false }));

    expect(screen.getByText("Attendance wasn't recorded. Contact PMCM to correct it.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Present" })).toBeNull();
  });
});

const issue = (overrides: Record<string, unknown>) => ({ id: "iss", eventId: "evt_1", title: "Issue", description: "", severity: "high", status: "open", affectedArea: "", ownerRole: "", ownerName: "", resolution: "", openedBy: "", createdAt: "", updatedAt: "", ...overrides });

describe("coordinator queues", () => {
  it("lists open issues most serious first and keeps resolved ones apart", () => {
    renderRoleData(roleView({
      guestAttendanceCount: 3,
      urgentIssues: [
        issue({ id: "low", title: "Spare chairs", severity: "low" }),
        issue({ id: "fixed", title: "Mic feedback", status: "resolved", resolution: "Swapped the receiver" }),
        issue({ id: "crit", title: "Generator down", severity: "critical", affectedArea: "Main Hall" }),
      ],
    }), {}, "issues");

    const open = within(screen.getByRole("region", { name: /Open issues/ }));
    const titles = open.getAllByRole("listitem").map((item) => item.textContent ?? "");
    expect(titles[0]).toContain("Generator down");
    expect(titles[1]).toContain("Spare chairs");
    expect(open.queryByText("Mic feedback")).toBeNull();
    expect(within(screen.getByRole("region", { name: /Resolved/ })).getByText("Swapped the receiver")).toBeTruthy();
    expect(screen.getByText("Guest names are hidden for your role.")).toBeTruthy();
  });

  it("groups tasks by where they stand, blocked first", () => {
    renderRoleData(roleView({
      tasks: [
        task({ id: "todo", title: "Aisle sweep" }),
        task({ id: "stuck", title: "Stage power", status: "blocked", blockedReason: "Waiting on the venue" }),
        task({ id: "going", title: "Doors", status: "in_progress" }),
      ],
    }));

    const groups = screen.getAllByRole("region").map((region) => region.getAttribute("aria-label")).filter(Boolean);
    expect(groups.slice(0, 3)).toEqual(["Blocked", "In progress", "To do"]);
    expect(screen.getByText("Waiting on the venue")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Unblock" })).toBeTruthy();
  });

  it("tells a coordinator who cannot log tasks why", () => {
    renderRoleData(roleView({ tasks: [] }), { taskBlockedReason: "Ask PMCM to update your assignment." });

    expect(screen.getByRole("note").textContent).toBe("Ask PMCM to update your assignment.");
  });

  it("says when nothing is assigned", () => {
    renderRoleData(roleView({ tasks: [] }));

    expect(screen.getByText(/No tasks assigned to you yet/)).toBeTruthy();
  });

  it("closes the Log a task panel once the task is saved", async () => {
    const onOpenChange = vi.fn();
    const taskForm = { title: "Stage cue check", setTitle: vi.fn(), role: "Floor Director", setRole: vi.fn(), priority: "normal", setPriority: vi.fn(), notes: "", setNotes: vi.fn(), dueAt: "", setDueAt: vi.fn(), assignToMe: false, setAssignToMe: vi.fn(), roleOptions: ["Floor Director"], blockedReason: null, routesAway: false, busy: false, error: null, submit: vi.fn(async () => true) } as unknown as CoordinatorTaskFormModel;
    render(<CoordinatorTaskSheet taskForm={taskForm} open onOpenChange={onOpenChange} />);

    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Log task" }));

    expect(taskForm.submit).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

