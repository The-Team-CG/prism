/** @vitest-environment jsdom */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { PrismEvent } from "@prism/types";
import type { PmcmCalendarEntry } from "@/features/pmcm-overview";
import { EventCalendarWorkspace } from "./event-calendar-workspace";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-12T00:00:00Z")); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

// jsdom has no ResizeObserver; the popover that lists a crowded day's hidden items measures itself with one.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => vi.unstubAllGlobals());

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
  fireEvent.keyDown(window, { key: "m" });
  return { onOpenItem, cell: () => document.querySelector<HTMLElement>('[data-date="2026-11-10"]') as HTMLElement };
}

describe("EventCalendarWorkspace", () => {
  it("keeps month highlights and counts within the month while loading neighboring grid dates", () => {
    const onRangeChange = vi.fn();
    render(
      <EventCalendarWorkspace
        events={[]}
        items={[items[0], { ...entry("next", "event", "overview", "December booking", "Event day"), date: "2026-12-01" }]}
        onRangeChange={onRangeChange}
        onOpenItem={vi.fn()}
        onOpenEvent={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: "m" });
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: "2026-11-01", to: "2026-12-05" });
    expect(within(screen.getByRole("group", { name: "Schedule categories" })).getByRole("button", { name: /^All scheduled\s*1$/ })).toBeTruthy();
    const highlights = within(screen.getByRole("region", { name: "Schedule highlights" }));
    expect(highlights.getAllByRole("button")).toHaveLength(1);
    expect(highlights.queryByText("December booking")).toBeNull();
    expect(within(document.querySelector<HTMLElement>('[data-date="2026-12-01"]') as HTMLElement).getByRole("button", { name: /December booking/ })).toBeTruthy();
  });

  it("labels the actual week and agenda ranges when navigating within a month", () => {
    renderCalendar();
    fireEvent.keyDown(window, { key: "w" });
    const dateButton = () => screen.getByRole("button", { name: "Choose calendar date" });
    expect(dateButton().textContent).toBe("Nov 8, 2026 – Nov 14, 2026");
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(dateButton().textContent).toBe("Nov 15, 2026 – Nov 21, 2026");
    fireEvent.keyDown(window, { key: "a" });
    expect(dateButton().textContent).toBe("Nov 19, 2026 – Dec 18, 2026");
  });

  it("rejects unsupported jump dates and navigates to a supported date", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Choose calendar date" }));
    const dateInput = screen.getByLabelText("Jump to date");
    for (const value of ["0099-11-12", "0999-11-12", "9999-01-01"]) {
      fireEvent.change(dateInput, { target: { value } });
      expect(screen.getByRole("grid", { name: "November 2026" })).toBeTruthy();
    }
    fireEvent.change(dateInput, { target: { value: "2027-01-20" } });
    expect(screen.getByRole("grid", { name: "January 2027" })).toBeTruthy();
  });

  it("searches schedule titles and details, filters categories, and opens a matching highlight", () => {
    const { onOpenItem } = renderCalendar();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search schedule" }), { target: { value: "Lights" } });
    const highlights = () => within(screen.getByRole("region", { name: "Schedule highlights" }));
    expect(highlights().getAllByRole("button")).toHaveLength(1);
    expect(highlights().queryByText("Deposit")).toBeNull();
    fireEvent.click(highlights().getByRole("button", { name: /Lights quote due/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Open suppliers" }));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Search schedule" }), { target: { value: "Gala" } });
    expect(highlights().getAllByRole("button")).toHaveLength(4);
    fireEvent.click(within(screen.getByRole("group", { name: "Schedule categories" })).getByRole("button", { name: /Payment due/ }));
    expect(highlights().getAllByRole("button")).toHaveLength(1);
    expect(highlights().getByRole("button", { name: /Deposit/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search schedule" }), { target: { value: "No match" } });
    expect(screen.getByRole("status").textContent).toContain("No matching entries");
  });

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
    fireEvent.keyDown(window, { key: "m" });
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-date="2026-11-10"]') as HTMLElement).getByRole("button", { name: /Load-in/ }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Open run sheet" }).getAttribute("href")).toBe("/dashboard/events/evt_1/run-sheet?dayId=day_0");
  });

  it("lists a crowded day's hidden items in a popup instead of leaving the month", () => {
    const { cell } = renderCalendar();
    fireEvent.click(within(cell()).getByRole("button", { name: "+1 more" }));

    const list = screen.getByText("Nov 10, 2026", { exact: true }).parentElement as HTMLElement;
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
