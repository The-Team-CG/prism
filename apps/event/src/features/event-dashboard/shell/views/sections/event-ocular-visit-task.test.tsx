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
  it("shows requested task details", () => {
    renderTask(requestedVisit);

    expect(screen.getByText("Summit")).toBeTruthy();
    expect(screen.getByText("Please coordinate with venue security.")).toBeTruthy();
    expect(screen.getByText("Requested")).toBeTruthy();
  });

  it("schedules a requested visit", async () => {
    const onSchedule = vi.fn(async () => undefined);
    renderTask(requestedVisit, { onSchedule });
    const localDateTime = "2026-10-17T10:30";

    fireEvent.change(screen.getByLabelText("Scheduled date and time"), {
      target: { value: localDateTime },
    });
    fireEvent.click(screen.getByRole("button", { name: "Schedule visit" }));

    await waitFor(() =>
      expect(onSchedule).toHaveBeenCalledWith({
        scheduledAt: new Date(localDateTime).toISOString(),
      }),
    );
  });

  it("completes a scheduled visit", async () => {
    const onComplete = vi.fn(async () => undefined);
    renderTask({
      ...requestedVisit,
      status: "scheduled",
      scheduledAt: "2026-10-17T02:30:00.000Z",
    }, { onComplete });

    fireEvent.click(screen.getByRole("button", { name: "Mark ocular visit complete" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
  });

  it("requires a waiver reason", async () => {
    const onWaive = vi.fn(async () => undefined);
    renderTask(null, { onWaive });

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
