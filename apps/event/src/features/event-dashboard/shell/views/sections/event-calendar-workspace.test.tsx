/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PrismEvent } from "@prism/types";
import type { PmcmCalendarEntry } from "@/features/pmcm-overview";
import { EventCalendarWorkspace } from "./event-calendar-workspace";

afterEach(() => cleanup());

const entry = (id: string, kind: PmcmCalendarEntry["kind"], target: PmcmCalendarEntry["target"], title: string, detail: string): PmcmCalendarEntry => ({
  id, kind, target, title, detail, date: "2026-11-10", eventId: "evt_1", chipLabel: title,
});

const items: PmcmCalendarEntry[] = [
  { ...entry("a", "event", "overview", "Gala", "Event day"), scheduleDayId: "day_main" },
  entry("b", "ocular_visit", "overview", "Ocular visit", "Gala"),
  entry("c", "quote_deadline", "suppliers", "Lights quote due", "Gala"),
  entry("d", "payment_due", "billing", "Deposit", "Gala"),
];

function renderCalendar(onOpenItem = vi.fn()) {
  render(
    <EventCalendarWorkspace
      events={[] as PrismEvent[]}
      items={items}
      onRangeChange={vi.fn()}
      onOpenItem={onOpenItem}
      onOpenEvent={vi.fn()}
    />,
  );
  return { onOpenItem, cell: () => document.querySelector<HTMLElement>('[data-date="2026-11-10"]') as HTMLElement };
}

describe("EventCalendarWorkspace", () => {
  it("leads an event day to its run sheet and a load-in day to the run sheet first", () => {
    const { cell } = renderCalendar();
    fireEvent.click(within(cell()).getByRole("button", { name: /Gala/ }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Open run sheet" }).getAttribute("href")).toBe("/dashboard/events/evt_1/run-sheet?dayId=day_main");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Open event" })).toBeTruthy();
    cleanup();

    render(
      <EventCalendarWorkspace
        events={[] as PrismEvent[]}
        items={[{ ...entry("d0", "schedule_day", "overview", "Load-in", "Gala"), scheduleDayId: "day_0" }]}
        onRangeChange={vi.fn()}
        onOpenItem={vi.fn()}
        onOpenEvent={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Gala/ }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Open run sheet" }).getAttribute("href")).toBe("/dashboard/events/evt_1/run-sheet?dayId=day_0");
  });

  it("lists a crowded day's hidden items in a popup instead of leaving the month", () => {
    const { cell } = renderCalendar();
    fireEvent.click(within(cell()).getByRole("button", { name: "+1 more" }));

    const list = screen.getByText("Nov 10, 2026", { exact: false }).parentElement as HTMLElement;
    expect(within(list).getAllByRole("button")).toHaveLength(4);
    expect(within(list).getByRole("button", { name: /Deposit/ })).toBeTruthy();
    expect(screen.getByRole("grid")).toBeTruthy();
  });

  it("opens an item's details in a side panel and sends the user to where it is handled", () => {
    const { onOpenItem, cell } = renderCalendar();
    fireEvent.click(within(cell()).getByRole("button", { name: /Lights quote due/ }));

    const panel = screen.getByRole("dialog");
    expect(within(panel).getByText("Lights quote due")).toBeTruthy();
    expect(within(panel).getByText(/All day/)).toBeTruthy();
    expect(onOpenItem).not.toHaveBeenCalled();

    fireEvent.click(within(panel).getByRole("button", { name: "Open suppliers" }));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: "c", target: "suppliers" }));
  });

  it("closes the panel with Escape and does not change view while it is open", () => {
    const { cell } = renderCalendar();
    fireEvent.click(within(cell()).getByRole("button", { name: /Lights quote due/ }));
    fireEvent.keyDown(window, { key: "w" });
    // The panel is modal, so the calendar behind it is hidden from queries by default.
    expect(screen.getByRole("button", { name: "Calendar view: Month", hidden: true })).toBeTruthy();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
