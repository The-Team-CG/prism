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
  milestones: [
    { kind: "conforme", title: "Conforme signed", state: "done", date: "2026-06-01", dated: true },
    { kind: "briefing", title: "Briefing sent", state: "done", date: "2026-06-03T07:40:45.687Z", dated: false, href: "/b" },
    { kind: "floorplan", title: "Floor plan approved", state: "next", date: null, dated: true, href: "/f" },
    { kind: "payment", title: "Balance paid", state: "upcoming", date: "2026-08-15", dated: true, href: "/p" },
    { kind: "event", title: "Event day", state: "upcoming", date: "2026-10-01", dated: true },
  ],
  clientEventDayStatus: null,
  needsYouCount: 0,
  actionsHref: "/dashboard/events/evt_1/actions",
};

const useEventProgressViewMock = vi.mocked(useEventProgressView);

describe("EventProgressView milestones", () => {
  it("shows one dated list with readable dates and an action only on what is next", () => {
    useEventProgressViewMock.mockReturnValue(baseProgress);
    render(createElement(EventProgressView));

    const list = screen.getByRole("region", { name: "Milestones" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Conforme signed"),
      expect.stringContaining("Briefing sent"),
      expect.stringContaining("Floor plan approved"),
      expect.stringContaining("Balance paid"),
      expect.stringContaining("Event day"),
    ]);
    expect(list.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(rows[1].textContent).toContain("Jun 3, 2026");
    expect(rows[2].textContent).toContain("Up next");
    expect(rows[2].textContent).toContain("Date to be set");
    expect(rows[3].textContent).toContain("Due Aug 15, 2026");
    expect(within(list).getAllByText(/^Open /)).toHaveLength(1);
  });

  it("shows only the generic event-day status supplied by the selected event view model", () => {
    useEventProgressViewMock.mockReturnValue({ ...baseProgress, clientEventDayStatus: "Event day is in progress." });
    const { rerender } = render(createElement(EventProgressView));
    expect(screen.getByRole("status").textContent).toContain("Event day is in progress.");

    useEventProgressViewMock.mockReturnValue({ ...baseProgress, clientEventDayStatus: null });
    rerender(createElement(EventProgressView));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
