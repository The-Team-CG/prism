/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrismPmcmOcularVisit } from "@prism/types";
import { EventOcularVisitTask } from "./event-ocular-visit-task";

afterEach(cleanup);

const requestedVisit: PrismPmcmOcularVisit = {
  eventId: "evt_1",
  status: "requested",
  clientNote: "Please coordinate with venue security.",
  scheduleNote: null,
  requestedAt: "2026-10-01T00:00:00.000Z",
  scheduledAt: null,
  completedAt: null,
  waiverReason: null,
  waivedAt: null,
  waivedBy: null,
};

function renderTask(
  visit: PrismPmcmOcularVisit | null,
  overrides: Partial<React.ComponentProps<typeof EventOcularVisitTask>> = {},
) {
  const props: React.ComponentProps<typeof EventOcularVisitTask> = {
    eventName: "Summit",
    visit,
    isAdmin: true,
    busy: false,
    onSchedule: vi.fn(async () => undefined),
    onComplete: vi.fn(async () => undefined),
    onWaive: vi.fn(async () => undefined),
    ...overrides,
  };
  render(<EventOcularVisitTask {...props} />);
  return props;
}

describe("EventOcularVisitTask", () => {
  it("shows the status on one row and reveals the request details on demand", () => {
    renderTask(requestedVisit);

    expect(screen.getByLabelText("Ocular visit status").textContent).toBe("Requested");
    expect(screen.queryByText("Please coordinate with venue security.")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Manage visit" }));

    expect(screen.getByText("Summit")).toBeTruthy();
    expect(screen.getByText("Please coordinate with venue security.")).toBeTruthy();
  });

  /** Opens the schedule form and picks 17 Oct 2026 at 10:30, the same way PMCM does in the picker. */
  function pickScheduleDateTime() {
    // Pin the clock so the picker opens on October 2026.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T12:00:00"));
    try {
      fireEvent.click(screen.getByLabelText("Scheduled date and time"));
      fireEvent.click(screen.getByRole("button", { name: /October 17(th)?, 2026/ }));
      fireEvent.click(screen.getByRole("option", { name: "10:30 AM" }));
    } finally {
      vi.useRealTimers();
    }
  }

  it("schedules a requested visit with an optional note", async () => {
    const onSchedule = vi.fn(async () => undefined);
    renderTask(requestedVisit, { onSchedule });
    fireEvent.click(screen.getByRole("button", { name: "Manage visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule visit" }));
    pickScheduleDateTime();
    fireEvent.change(screen.getByLabelText("Note for the client (optional)"), { target: { value: "  Gate 2 access  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));

    await waitFor(() =>
      expect(onSchedule).toHaveBeenCalledWith({
        scheduledAt: new Date("2026-10-17T10:30").toISOString(),
        note: "Gate 2 access",
      }),
    );
  });

  it("lets PMCM schedule a visit when no client request is on file, then shows it as scheduled", async () => {
    const onSchedule = vi.fn(async () => undefined);
    const { rerender } = render(<EventOcularVisitTask eventName="Summit" visit={null} isAdmin busy={false} onSchedule={onSchedule} onComplete={vi.fn(async () => undefined)} onWaive={vi.fn(async () => undefined)} />);
    fireEvent.click(screen.getByRole("button", { name: "Manage visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule visit" }));
    pickScheduleDateTime();
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }));

    await waitFor(() =>
      expect(onSchedule).toHaveBeenCalledWith({ scheduledAt: new Date("2026-10-17T10:30").toISOString() }),
    );
    expect(screen.queryByRole("button", { name: "Save schedule" })).toBeNull();

    rerender(<EventOcularVisitTask
      eventName="Summit"
      visit={{ ...requestedVisit, status: "scheduled", clientNote: null, scheduleNote: "Gate 2 access", requestedAt: null, scheduledAt: new Date("2026-10-17T10:30").toISOString() }}
      isAdmin
      busy={false}
      onSchedule={onSchedule}
      onComplete={vi.fn(async () => undefined)}
      onWaive={vi.fn(async () => undefined)}
    />);
    expect(screen.getByLabelText("Ocular visit status").textContent).toBe("Scheduled");
    expect(screen.queryByRole("button", { name: "Schedule visit" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reschedule visit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark ocular visit complete" })).toBeTruthy();
    expect(screen.getByText("Note for the client")).toBeTruthy();
    expect(screen.getByText("Gate 2 access")).toBeTruthy();
  });

  it("closes the schedule form without saving when PMCM cancels", () => {
    const onSchedule = vi.fn(async () => undefined);
    renderTask(null, { onSchedule });
    fireEvent.click(screen.getByRole("button", { name: "Manage visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("button", { name: "Save schedule" })).toBeNull();
    expect(screen.getByRole("button", { name: "Schedule visit" })).toBeTruthy();
    expect(onSchedule).not.toHaveBeenCalled();
  });

  it("completes a scheduled visit", async () => {
    const onComplete = vi.fn(async () => undefined);
    renderTask({
      ...requestedVisit,
      status: "scheduled",
      scheduledAt: "2026-10-17T02:30:00.000Z",
    }, { onComplete });

    fireEvent.click(screen.getByRole("button", { name: "Manage visit" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark ocular visit complete" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it("requires a waiver reason", async () => {
    const onWaive = vi.fn(async () => undefined);
    renderTask(null, { onWaive });
    fireEvent.click(screen.getByRole("button", { name: "Manage visit" }));

    const submit = screen.getByRole("button", { name: "Waive ocular visit" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Waiver reason"), {
      target: { value: "Venue has provided an approved layout." },
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => expect(onWaive).toHaveBeenCalledWith({
      reason: "Venue has provided an approved layout.",
    }));
  });

  it("hides mutation actions for terminal states", () => {
    renderTask({
      ...requestedVisit,
      status: "completed",
      completedAt: "2026-10-17T02:30:00.000Z",
    });

    expect(screen.queryByRole("button", { name: "Schedule visit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mark ocular visit complete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Waive ocular visit" })).toBeNull();
  });

  it("keeps controls hidden for non-admin PMCM users", () => {
    renderTask(requestedVisit, { isAdmin: false });

    expect(screen.queryByRole("button", { name: "Schedule visit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Waive ocular visit" })).toBeNull();
  });
});
