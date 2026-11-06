/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReassignmentReviewPanel } from "./live-ops-sections";
import { LiveOperationsWorkspace } from "./live-operations-workspace";

vi.mock("@/features/live-ops/schedule", () => ({
  LiveOpsControlSurface: () => <section aria-label="Run window">Run window</section>,
  LiveOpsScheduleDesk: () => <div>Schedule desk</div>,
  eventRunSheetHref: (eventId: string) => `/run-sheet/${eventId}`,
}));

afterEach(cleanup);

const liveOps = {
  tasks: [{ id: "task_1", title: "Stage cue check" }],
  taskReassignmentRequests: [
    { id: "req_1", eventId: "evt_1", taskId: "task_1", requestedBy: "Marco Santos", requestedByRole: "coordinator", fromOwnerRole: "Floor Director", fromOwnerName: "", toOwnerRole: "Stage Director", toOwnerName: "Sam Cruz", reason: "Marco is on the floor", status: "pending", requestedAt: "2026-10-01T08:00:00.000Z", autoApproveAt: "2026-10-01T08:02:00.000Z" },
    { id: "req_done", eventId: "evt_1", taskId: "task_1", requestedBy: "Marco Santos", requestedByRole: "coordinator", fromOwnerRole: "Usher", fromOwnerName: "", toOwnerRole: "Floor Director", toOwnerName: "", reason: "Already handled", status: "approved", requestedAt: "2026-10-01T07:00:00.000Z", autoApproveAt: "2026-10-01T07:02:00.000Z" },
  ],
};

function renderPanel() {
  const onDecide = vi.fn(async () => {});
  render(<ReassignmentReviewPanel liveOps={liveOps as never} busy={false} onDecide={onDecide} />);
  return onDecide;
}

describe("ReassignmentReviewPanel", () => {
  it("shows the pending request with the task's title and hides decided ones", () => {
    renderPanel();

    expect(screen.getByText(/Task: Stage cue check\. Requested by Marco Santos\. Marco is on the floor/)).toBeTruthy();
    expect(screen.queryByText(/Already handled/)).toBeNull();
  });

  it("approves without a note", () => {
    const onDecide = renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(onDecide).toHaveBeenCalledWith("req_1", expect.objectContaining({ decision: "approved" }));
  });

  it("only rejects once a note is given and sends that note", () => {
    const onDecide = renderPanel();
    const reject = screen.getByRole("button", { name: "Reject" });
    expect(reject.hasAttribute("disabled")).toBe(true);

    fireEvent.change(screen.getByLabelText(/Decision note/), { target: { value: "Sam is already on stage" } });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(onDecide).toHaveBeenCalledWith("req_1", { decision: "rejected", reason: "Sam is already on stage" });
  });
});

describe("LiveOperationsWorkspace desk order", () => {
  // The event is dated Oct 2, 2026; pin the clock before it so the desk is still live.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T04:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const issue = (id: string, status: string, severity: string) => ({ id, eventId: "evt_1", title: `Issue ${id}`, description: "", severity, status, affectedArea: "", ownerRole: "Floor Director" });

  it("leads with the run window and open issues, and keeps creation forms closed until asked", () => {
    const noop = vi.fn(async () => {});
    render(
      <LiveOperationsWorkspace
        event={{ id: "evt_1", eventName: "Gala", clientName: "Ana", eventDate: "2026-10-02" } as never}
        liveOps={{
          tasks: [], supplierStatuses: [], coordinatorAssignments: [], guestAttendanceCount: 0, guestCheckIns: [], eventDayLogs: [],
          urgentIssues: [issue("closed", "resolved", "critical"), issue("open", "open", "high")],
          schedule: { eventId: "evt_1", authored: true, days: [], serverTime: "2026-10-02T00:00:00.000Z" },
        } as never}
        statusFeed={null}
        coordinators={[]}
        busy={false}
        onReload={noop}
        onCreateTask={noop}
        onUpdateTask={noop}
        onEscalateTask={noop}
        onCreateIssue={noop}
        onUpdateIssue={noop}
        onEscalateIssue={noop}
        onUpdateCoordinatorAttendance={noop}
        onReplaceCoordinator={noop}
        onLoadCoordinatorSuggestions={vi.fn(async () => [])}
        onVerifySupplierStatus={noop}
        onDecideTaskReassignment={noop}
      />,
    );

    const runWindow = screen.getByRole("region", { name: "Run window" });
    const issues = screen.getByRole("region", { name: "Urgent issues" });
    expect(runWindow.compareDocumentPosition(issues) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const titles = Array.from(issues.querySelectorAll("p.font-semibold")).map((node) => node.textContent);
    expect(titles.indexOf("Issue open")).toBeLessThan(titles.indexOf("Issue closed"));

    const issueForm = document.getElementById("live-ops-issue-form") as HTMLElement;
    const taskForm = document.getElementById("live-ops-task-form") as HTMLElement;
    expect(issueForm.hidden).toBe(true);
    expect(taskForm.hidden).toBe(true);

    const logIssue = screen.getByRole("button", { name: "Log issue" });
    expect(logIssue.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(logIssue);
    expect(issueForm.hidden).toBe(false);
    expect(screen.getByRole("button", { name: "Close form" }).getAttribute("aria-expanded")).toBe("true");
    expect(taskForm.hidden).toBe(true);
  });

  it("gives every visible form control in the live desk an accessible name", () => {
    const noop = vi.fn(async () => {});
    render(
      <LiveOperationsWorkspace
        event={{ id: "evt_1", eventName: "Gala", clientName: "Ana", eventDate: "2026-10-02" } as never}
        liveOps={{
          tasks: [], supplierStatuses: [], coordinatorAssignments: [], guestAttendanceCount: 0, guestCheckIns: [], eventDayLogs: [], urgentIssues: [],
          schedule: { eventId: "evt_1", authored: true, days: [], serverTime: "2026-10-02T00:00:00.000Z" },
        } as never}
        statusFeed={null}
        coordinators={[]}
        busy={false}
        onReload={noop}
        onCreateTask={noop}
        onUpdateTask={noop}
        onEscalateTask={noop}
        onCreateIssue={noop}
        onUpdateIssue={noop}
        onEscalateIssue={noop}
        onUpdateCoordinatorAttendance={noop}
        onReplaceCoordinator={noop}
        onLoadCoordinatorSuggestions={vi.fn(async () => [])}
        onVerifySupplierStatus={noop}
        onDecideTaskReassignment={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Log issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Add task" }));

    const visibleControls = Array.from(document.querySelectorAll("input, select, textarea")).filter((el) => !el.closest("[hidden]"));
    expect(visibleControls.length).toBeGreaterThan(0);
    const unnamed = visibleControls.filter((el) => !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !(el as HTMLInputElement).labels?.length);
    expect(unnamed.map((el) => el.outerHTML.slice(0, 120))).toEqual([]);
  });
});

describe("LiveOperationsWorkspace after the event date", () => {
  const event = { id: "evt_1", eventDate: "2026-06-18", clientName: "Ayala Holdings", eventName: "Ayala Tech Summit 2026" };
  const fullLiveOps = {
    schedule: { authored: true },
    timer: null,
    guestAttendanceCount: 0,
    urgentIssues: [{ id: "issue_1", title: "Generator fault", description: "", affectedArea: "Stage", ownerRole: "Floor Director", severity: "high", status: "open", slaStatus: "on_track", slaDueAt: null, escalationLevel: "none", escalatedBy: null }],
    tasks: [{ id: "task_1", title: "Stage cue check", assignedRole: "Floor Director", ownerName: "", priority: "normal", status: "open", slaStatus: "on_track", slaDueAt: null, escalationLevel: "none", escalatedBy: null }],
    taskReassignmentRequests: [{ id: "req_1", eventId: "evt_1", taskId: "task_1", requestedBy: "Marco Santos", requestedByRole: "coordinator", fromOwnerRole: "Floor Director", fromOwnerName: "", toOwnerRole: "Stage Director", toOwnerName: "Sam Cruz", reason: "On stage", status: "pending" }],
    coordinatorAssignments: [],
    supplierStatuses: [],
    eventDayLogs: [{ id: "log_1", message: "Doors opened", actionType: "note", actor: "PMCM", createdAt: "2026-06-18T00:30:00.000Z" }],
  };

  function renderWorkspace() {
    const noop = () => vi.fn(async () => {});
    render(
      <LiveOperationsWorkspace
        event={event as never}
        liveOps={fullLiveOps as never}
        statusFeed={null}
        coordinators={[]}
        busy={false}
        onReload={noop()}
        onCreateTask={noop()}
        onUpdateTask={noop()}
        onEscalateTask={noop()}
        onCreateIssue={noop()}
        onUpdateIssue={noop()}
        onEscalateIssue={noop()}
        onUpdateCoordinatorAttendance={noop()}
        onReplaceCoordinator={noop()}
        onLoadCoordinatorSuggestions={async () => []}
        onVerifySupplierStatus={noop()}
        onDecideTaskReassignment={noop()}
      />,
    );
  }

  afterEach(() => vi.useRealTimers());

  it("keeps the desk history visible but closes live entry once the event date has passed", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T04:00:00Z"));
    renderWorkspace();

    expect(screen.getByText(/Event ended on Jun 18, 2026/)).toBeTruthy();
    expect(screen.getByText("Stage cue check")).toBeTruthy();
    expect(screen.getByText("Generator fault")).toBeTruthy();
    expect(screen.getByText("Doors opened")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Log issue" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add task" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark resolved" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Escalate task" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Run window" })).toBeNull();
  });

  it("keeps live entry open on the event day", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-18T02:00:00Z"));
    renderWorkspace();

    expect(screen.queryByText(/Event ended on/)).toBeNull();
    expect(screen.getByRole("button", { name: "Log issue" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark resolved" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Run window" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
  });
});

