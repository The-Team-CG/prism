/** @vitest-environment jsdom */
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { EventProgressViewModel } from "../view-models/use-event-progress-view";
import { EventProgressView } from "./event-progress-view";
import { useEventProgressView } from "../view-models/use-event-progress-view";

vi.mock("../view-models/use-event-progress-view", () => ({
  useEventProgressView: vi.fn(),
}));

afterEach(cleanup);

const baseProgress: EventProgressViewModel = {
  hasEvent: true,
  lifecycleStage: "Planning",
  lifecycleIndex: 3,
  checkpoints: [],
  timeline: [
    { id: "conforme_signed", title: "Conforme signed", status: "completed", meta: "2026-06-01" },
    { id: "proposal_accepted", title: "Proposal accepted", status: "completed", meta: "2026-06-05" },
    { id: "floor_plan_approved", title: "Floor plan approved", status: "current", meta: "Date pending" },
    { id: "balance_payment_due", title: "Balance payment due", status: "pending", meta: "2026-08-15" },
    { id: "event_date", title: "Event date", status: "pending", meta: "2026-10-01" },
  ],
  paymentMilestones: [],
  score: 40,
  clientEventDayStatus: null,
  clientActions: [],
  runClientAction: vi.fn(),
};

const useEventProgressViewMock = vi.mocked(useEventProgressView);

describe("EventProgressView client timeline", () => {
  it("renders the five source-backed statuses and pending-date copy", () => {
    useEventProgressViewMock.mockReturnValue(baseProgress);
    render(createElement(EventProgressView));

    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Conforme signed"),
      expect.stringContaining("Proposal accepted"),
      expect.stringContaining("Floor plan approved"),
      expect.stringContaining("Balance payment due"),
      expect.stringContaining("Event date"),
    ]);
    expect(within(rows[0]).getByText("completed")).toBeTruthy();
    expect(within(rows[2]).getByText("current")).toBeTruthy();
    expect(within(rows[2]).getByText("Date pending")).toBeTruthy();
  });

  it("shows only the generic event-day status supplied by the selected event view model", () => {
    useEventProgressViewMock.mockReturnValue({
      ...baseProgress,
      clientEventDayStatus: "Event day is in progress.",
    });
    const { rerender } = render(createElement(EventProgressView));
    expect(screen.getByRole("status").textContent).toContain("Event day is in progress.");

    useEventProgressViewMock.mockReturnValue({
      ...baseProgress,
      clientEventDayStatus: null,
    });
    rerender(createElement(EventProgressView));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
