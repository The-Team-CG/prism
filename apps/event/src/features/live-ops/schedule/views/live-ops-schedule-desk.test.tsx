/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrismCoordinatorAssignment, PrismEventEodReport, PrismEventSchedule } from "@prism/types";
import { LiveOpsScheduleDesk } from "./live-ops-schedule-desk";

const { repository } = vi.hoisted(() => ({
  repository: {
    getSchedule: vi.fn(),
    getEvent: vi.fn(),
    startEventDay: vi.fn(),
    listHandoffs: vi.fn(),
    listEodReports: vi.fn(),
    createDay: vi.fn(),
    createSegment: vi.fn(),
    updateSegmentStatus: vi.fn(),
    createHandoff: vi.fn(),
    submitEodReport: vi.fn(),
    replyEodReport: vi.fn(),
  },
}));

vi.mock("../data/live-ops-schedule-repository", () => ({ liveOpsScheduleRepository: repository }));

afterEach(() => cleanup());

const schedule: PrismEventSchedule = {
  eventId: "evt_1",
  authored: true,
  serverTime: "2026-10-02T00:00:00.000Z",
  days: [{
    id: "day_1",
    eventId: "evt_1",
    dayDate: "2026-10-02",
    label: "Event day",
    status: "planned",
    segments: [{
      id: "segment_1",
      dayId: "day_1",
      sequence: 0,
      title: "Doors open",
      plannedStartAt: "2026-10-02T08:00:00.000Z",
      plannedEndAt: "2026-10-02T09:00:00.000Z",
      ownerRole: "Registration Staff",
      location: "Lobby",
      status: "planned",
      actualStartedAt: null,
      actualEndedAt: null,
      startVarianceMinutes: null,
      endVarianceMinutes: null,
    }],
  }],
};

const assignments: PrismCoordinatorAssignment[] = [
  { id: "assignment_1", eventId: "evt_1", coordinatorName: "Rhea Santos", role: "Floor Director", status: "acknowledged", doubleBookingWarning: false },
  { id: "assignment_2", eventId: "evt_1", coordinatorName: "Taylor Lee", role: "Floor Director", status: "acknowledged", doubleBookingWarning: false },
];

const report: PrismEventEodReport = {
  id: "report_1",
  eventId: "evt_1",
  dayId: "day_1",
  authoredBy: "coord_1",
  authoredByRole: "coordinator",
  canEdit: false,
  progress: ["Doors opened"],
  issues: ["Queue at north entrance"],
  risksForTomorrow: [],
  submittedAt: "2026-10-02T18:00:00.000Z",
  replies: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  repository.getSchedule.mockResolvedValue(schedule);
  repository.getEvent.mockResolvedValue({ status: "event_day" });
  repository.startEventDay.mockResolvedValue({ eventId: "evt_1", status: "event_day" });
  repository.listHandoffs.mockResolvedValue([]);
  repository.listEodReports.mockResolvedValue([]);
  repository.createDay.mockResolvedValue({});
  repository.createSegment.mockResolvedValue({});
  repository.updateSegmentStatus.mockResolvedValue({});
  repository.createHandoff.mockResolvedValue({});
  repository.submitEodReport.mockResolvedValue(report);
  repository.replyEodReport.mockResolvedValue({ id: "reply_1" });
});

/** Opening the calendar pop-up is slow in jsdom when the whole suite runs in parallel. */
const PICKER_TEST_TIMEOUT_MS = 20_000;

/** Picks a day and time in the shared date-and-time picker; the clock is pinned so it opens on October 2026. */
function pickDateTime(trigger: HTMLElement, day: number, time: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-01T12:00:00"));
  try {
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`October ${day}(st|nd|rd|th)?, 2026`) }));
    fireEvent.click(screen.getByRole("option", { name: time }));
  } finally {
    vi.useRealTimers();
  }
}

describe("LiveOpsScheduleDesk", () => {
  it("lets PMCM start event day and reflects the saved event status", async () => {
    repository.getEvent.mockResolvedValueOnce({ status: "planning" }).mockResolvedValue({ status: "event_day" });
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canStartEventDay canManageSchedule canReplyToReports canSubmitReports={false} />);
    fireEvent.click(await screen.findByRole("button", { name: "Start event day" }));
    await waitFor(() => expect(repository.startEventDay).toHaveBeenCalledWith("evt_1"));
    expect(await screen.findByText("Event day is active")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start event day" })).toBeNull();
  });

  it("does not offer event-day start to a coordinator who can manage the schedule", async () => {
    repository.getEvent.mockResolvedValue({ status: "planning" });
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canManageSchedule canReplyToReports={false} canSubmitReports />);
    await screen.findByText("Doors open");
    expect(screen.queryByRole("button", { name: "Start event day" })).toBeNull();
  });
  it("lets the designated operator add a day and a timed schedule segment", async () => {
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canManageSchedule canReplyToReports={false} canSubmitReports />);

    await screen.findByText("Doors open");
    fireEvent.change(screen.getByLabelText("Day date"), { target: { value: "10/03/2026" } });
    fireEvent.change(screen.getByLabelText("Day label (optional)"), { target: { value: "Strike" } });
    fireEvent.click(screen.getByRole("button", { name: "Add day" }));
    await waitFor(() => expect(repository.createDay).toHaveBeenCalledWith("evt_1", { dayDate: "2026-10-03", label: "Strike" }));

    fireEvent.change(screen.getByLabelText("Segment title"), { target: { value: "Vendor load-out" } });
    // The field label wraps the picker, so open it from the picker's own button.
    const pickerButton = (text: string) => screen.getByText(text, { selector: "span" }).closest("label")!.querySelector("button")!;
    pickDateTime(pickerButton("Starts"), 2, "8:00 PM");
    pickDateTime(pickerButton("Ends"), 2, "9:00 PM");
    fireEvent.change(screen.getByLabelText("Owner role"), { target: { value: "General Coordinator" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
    await waitFor(() => expect(repository.createSegment).toHaveBeenCalledWith("evt_1", "day_1", expect.objectContaining({
      title: "Vendor load-out",
      ownerRole: "General Coordinator",
      sequence: 1,
    })));
    const [, , input] = repository.createSegment.mock.calls[0] as unknown as [string, string, { plannedStartAt: string; plannedEndAt: string }];
    expect(new Date(input.plannedEndAt).getTime()).toBeGreaterThan(new Date(input.plannedStartAt).getTime());
  }, PICKER_TEST_TIMEOUT_MS);

  it("lets PMCM update a schedule segment and reply to an end-of-day report", async () => {
    repository.listEodReports.mockResolvedValue([report]);
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canManageSchedule canReplyToReports canSubmitReports={false} />);

    expect(await screen.findByText("Doors open")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Submit end-of-day report" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(repository.updateSegmentStatus).toHaveBeenCalledWith("evt_1", "segment_1", { action: "start" }));
    expect(await screen.findByText("Schedule segment updated.")).toBeTruthy();
  });

  it("lets an assigned coordinator submit an end-of-day report without PMCM schedule or reply controls", async () => {
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canManageSchedule={false} canReplyToReports={false} canSubmitReports />);

    expect(await screen.findByText("Doors open")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add day" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Add$/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
    expect((screen.getByRole("button", { name: "Submit end-of-day report" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Progress (one item per line)"), { target: { value: "Doors opened\nProgram started" } });
    fireEvent.change(screen.getByLabelText("Issues (one item per line)"), { target: { value: "Queue at north entrance" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit end-of-day report" }));

    await waitFor(() => expect(repository.submitEodReport).toHaveBeenCalledWith("evt_1", {
      dayId: "day_1",
      progress: ["Doors opened", "Program started"],
      issues: ["Queue at north entrance"],
      risksForTomorrow: [],
    }));
  });

  it("does not let a coordinator replace another coordinator's report", async () => {
    repository.listEodReports.mockResolvedValue([report]);
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canManageSchedule={false} canReplyToReports={false} canSubmitReports />);

    expect(await screen.findByText("Doors opened")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Only its original author can update it");
    expect(screen.queryByRole("button", { name: /end-of-day report/i })).toBeNull();
    expect(repository.submitEodReport).not.toHaveBeenCalled();
  });

  it("prefills the original author's report before allowing an intentional update", async () => {
    repository.listEodReports.mockResolvedValue([{ ...report, canEdit: true }]);
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canManageSchedule={false} canReplyToReports={false} canSubmitReports />);

    const progress = await screen.findByLabelText("Progress (one item per line)") as HTMLTextAreaElement;
    expect(progress.value).toBe("Doors opened");
    expect((screen.getByRole("button", { name: "Update end-of-day report" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(progress, { target: { value: "Doors opened\nGuests seated" } });
    fireEvent.click(screen.getByRole("button", { name: "Update end-of-day report" }));

    await waitFor(() => expect(repository.submitEodReport).toHaveBeenCalledWith("evt_1", {
      dayId: "day_1",
      progress: ["Doors opened", "Guests seated"],
      issues: ["Queue at north entrance"],
      risksForTomorrow: [],
    }));
  });

  it("records shift handoffs with current same-role assignments and outstanding items", async () => {
    render(<LiveOpsScheduleDesk eventId="evt_1" assignments={assignments} canManageSchedule={false} canReplyToReports={false} canSubmitReports />);

    await screen.findByText("Doors open");
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Floor Director" } });
    fireEvent.change(screen.getByLabelText("Outstanding items (one per line)"), { target: { value: "Confirm cue\nCheck radio" } });
    fireEvent.click(screen.getByRole("button", { name: "Record handoff" }));

    await waitFor(() => expect(repository.createHandoff).toHaveBeenCalledWith("evt_1", {
      dayId: "day_1",
      role: "Floor Director",
      fromAssignmentId: "assignment_1",
      toAssignmentId: "assignment_2",
      outstandingItems: ["Confirm cue", "Check radio"],
    }));
  });
});
