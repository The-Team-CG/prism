/** @vitest-environment jsdom */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
      items={items}
      onRangeChange={vi.fn()}
      onOpenItem={onOpenItem}
    />,
  );
  return { onOpenItem, cell: () => document.querySelector<HTMLElement>('[data-date="2026-11-10"]') as HTMLElement };
}

describe("EventCalendarWorkspace", () => {
  it("opens Day as a single-date agenda with all-day entries before chronological times and keeps detail actions", () => {
    const onOpenItem = vi.fn();
    const onRangeChange = vi.fn();
    render(<EventCalendarWorkspace items={[
      { ...items[1], id: "late", title: "Afternoon visit", date: "2026-11-12", startTime: "14:00" },
      { ...items[2], id: "all", title: "Quote due", date: "2026-11-12" },
      { ...items[1], id: "early", title: "Morning visit", date: "2026-11-12", startTime: "09:00", endTime: "09:15" },
      { ...items[3], id: "tomorrow", title: "Tomorrow's payment", date: "2026-11-13" },
    ]} onRangeChange={onRangeChange} onOpenItem={onOpenItem} />);
    fireEvent.keyDown(window, { key: "d" });
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: "2026-11-12", to: "2026-11-12" });
    expect(screen.getByRole("button", { name: "Agenda" }).getAttribute("aria-pressed")).toBe("true");
    const agenda = within(screen.getByRole("region", { name: "Daily agenda" }));
    expect(agenda.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Quote dueAll day · Gala", "Morning visit9am – 9:15am · Gala", "Afternoon visit2pm · Gala",
    ]);
    expect(screen.queryByText("Tomorrow's payment")).toBeNull();
    fireEvent.click(agenda.getByRole("button", { name: /^Morning visit/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Open event" }));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: "early" }));
  });

  it("navigates Day by one date, reports empty and filtered days, and returns to today", () => {
    const onRangeChange = vi.fn();
    render(<EventCalendarWorkspace items={[{ ...items[0], date: "2026-11-12" }]} onRangeChange={onRangeChange} onOpenItem={vi.fn()} />);
    fireEvent.keyDown(window, { key: "d" });
    fireEvent.click(screen.getByRole("button", { name: "Next day" }));
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: "2026-11-13", to: "2026-11-13" });
    expect(screen.getByRole("status").textContent).toBe("Nothing scheduled on this day.");
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    expect(screen.getByText("1 entry on this day")).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search schedule" }), { target: { value: "No match" } });
    expect(screen.getByRole("status").textContent).toContain("No matching entries on this day");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search schedule" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }));
    fireEvent.click(screen.getByRole("button", { name: "Today" }));
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: "2026-11-12", to: "2026-11-12" });
    fireEvent.click(screen.getByRole("button", { name: "Choose calendar date" }));
    fireEvent.change(screen.getByLabelText("Jump to date"), { target: { value: "2027-01-01" } });
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: "2027-01-01", to: "2027-01-01" });
  });

  it("offers a time grid for the selected date and reopens Day as an agenda from Month or Week", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Open Nov 10, 2026" }));
    expect(screen.getByRole("region", { name: "Daily agenda" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Time grid" }));
    expect(screen.queryByRole("region", { name: "Daily agenda" })).toBeNull();
    expect(screen.getByRole("button", { name: "Time grid" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("gridcell", { name: "Nov 10, 2026" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByRole("region", { name: "Daily agenda" })).toBeTruthy();
    for (const shortcut of ["w", "m"]) {
      fireEvent.click(screen.getByRole("button", { name: "Time grid" }));
      fireEvent.keyDown(window, { key: shortcut });
      expect(screen.queryByRole("group", { name: "Day layout" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Open Nov 10, 2026" }));
      expect(screen.getByRole("region", { name: "Daily agenda" })).toBeTruthy();
    }
  });

  it("highlights the filtered period's upcoming entries first and preserves the detail action when collapsed", () => {
    const onOpenItem = vi.fn();
    render(<EventCalendarWorkspace items={[
      ...items,
      { ...items[2], id: "today", title: "Today's quote", date: "2026-11-12" },
      { ...items[3], id: "future", title: "Next payment", date: "2026-11-15" },
      { ...items[0], id: "outside", title: "Next month event", date: "2026-12-01" },
    ]} onRangeChange={vi.fn()} onOpenItem={onOpenItem} />);
    const highlights = () => within(screen.getByRole("region", { name: "Schedule highlights" }));
    const cards = highlights().getAllByRole("button");
    expect(cards).toHaveLength(3);
    expect(cards[0].textContent).toContain("Today's quote");
    expect(cards[1].textContent).toContain("Next payment");
    expect(highlights().queryByText("Next month event")).toBeNull();
    fireEvent.click(cards[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Open suppliers" }));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: "today" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Hide highlights" }));
    expect(screen.queryByRole("region", { name: "Schedule highlights" })).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search schedule" }), { target: { value: "Today's quote" } });
    const cell = document.querySelector<HTMLElement>('[data-date="2026-11-12"]');
    if (!cell) throw new Error("The selected month's date was not rendered");
    fireEvent.click(within(cell).getByRole("button", { name: /Today's quote/ }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Open suppliers" })).toBeTruthy();
  });

  it("removes stale highlights when searching or navigating to an empty period", () => {
    renderCalendar();
    const search = screen.getByRole("searchbox", { name: "Search schedule" });
    fireEvent.change(search, { target: { value: "Lights" } });
    expect(within(screen.getByRole("region", { name: "Schedule highlights" })).getAllByRole("button")).toHaveLength(1);
    fireEvent.change(search, { target: { value: "No matching item" } });
    expect(screen.queryByRole("region", { name: "Schedule highlights" })).toBeNull();
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(screen.queryByRole("region", { name: "Schedule highlights" })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Nothing scheduled");
  });

  it("opens on Month and counts only that month while loading neighboring grid dates", () => {
    const onRangeChange = vi.fn();
    render(
      <EventCalendarWorkspace
        items={[items[0], { ...entry("next", "event", "overview", "December booking", "Event day"), date: "2026-12-01" }]}
        onRangeChange={onRangeChange}
        onOpenItem={vi.fn()}
      />,
    );
    expect(onRangeChange).toHaveBeenLastCalledWith({ from: "2026-11-01", to: "2026-12-05" });
    fireEvent.click(screen.getByRole("button", { name: "Filter schedule" }));
    expect(within(screen.getByRole("group", { name: "Schedule categories" })).getByRole("button", { name: /^All scheduled\s*1$/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Quote deadline/ })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("button", { name: "Calendar view: Month" })).toBeTruthy();
    expect(within(document.querySelector<HTMLElement>('[data-date="2026-12-01"]') as HTMLElement).getByRole("button", { name: /December booking/ })).toBeTruthy();
  });

  it("labels the actual week and agenda ranges when navigating within a month", () => {
    renderCalendar();
    fireEvent.keyDown(window, { key: "w" });
    const dateButton = () => screen.getByRole("button", { name: "Choose calendar date" });
    expect(dateButton().textContent).toBe("Nov 8–14, 2026");
    fireEvent.click(screen.getByRole("button", { name: "Next period" }));
    expect(dateButton().textContent).toBe("Nov 15–21, 2026");
    fireEvent.keyDown(window, { key: "a" });
    expect(dateButton().textContent).toBe("Nov 19 – Dec 18, 2026");
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

  it("searches titles and details, filters categories, and opens the matching item's action", () => {
    const { onOpenItem, cell } = renderCalendar();
    const search = screen.getByRole("searchbox", { name: "Search schedule" });
    fireEvent.change(search, { target: { value: "Lights" } });
    expect(within(cell()).queryByRole("button", { name: /Deposit/ })).toBeNull();
    fireEvent.click(within(cell()).getByRole("button", { name: /Lights quote due/ }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Open suppliers" }));
    expect(onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ id: "c" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.change(search, { target: { value: "Gala" } });
    expect(within(cell()).getByRole("button", { name: "+1 more" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Filter schedule" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Schedule categories" })).getByRole("button", { name: /Payment due/ }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(within(cell()).getByRole("button", { name: /Deposit/ })).toBeTruthy();
    expect(within(cell()).queryByRole("button", { name: /^Gala/ })).toBeNull();
    const highlights = within(screen.getByRole("region", { name: "Schedule highlights" }));
    expect(highlights.getAllByRole("button")).toHaveLength(1);
    expect(highlights.getByRole("button", { name: /^Deposit/ })).toBeTruthy();
    fireEvent.change(search, { target: { value: "No match" } });
    expect(screen.getByRole("status").textContent).toContain("No matching entries");
  });

  it("keeps an active zero-count category available and clears category and timing together", () => {
    renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Filter schedule" }));
    fireEvent.click(screen.getByRole("button", { name: /Payment due/ }));
    fireEvent.click(screen.getByRole("button", { name: "Timed entries" }));
    expect(screen.getByRole("button", { name: /^Payment due\s*0$/ }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("4 entries in this period")).toBeTruthy();
  });

  it("explains Manila time without changing the Philippine date or item action", () => {
    const { cell } = renderCalendar();
    fireEvent.click(screen.getByRole("button", { name: "Manila time" }));
    expect(screen.getByText("Asia/Manila · UTC+08:00")).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.keyDown(window, { key: "w" });
    expect(screen.getByRole("button", { name: "Open Nov 12, 2026" }).getAttribute("aria-current")).toBe("date");
    fireEvent.keyDown(window, { key: "m" });
    fireEvent.click(within(cell()).getByRole("button", { name: /Lights quote due/ }));
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Open suppliers" })).toBeTruthy();
  });

  it("keeps a short timed entry's full title and time accessible through its details", () => {
    const title = "Confirm the final venue loading and access arrangements";
    render(<EventCalendarWorkspace items={[{ ...items[1], title, startTime: "09:00", endTime: "09:15" }]} onRangeChange={vi.fn()} onOpenItem={vi.fn()} />);
    fireEvent.keyDown(window, { key: "w" });
    const cell = document.querySelector<HTMLElement>('[data-date="2026-11-10"]');
    if (!cell) throw new Error("The timed entry's date was not rendered");
    fireEvent.click(within(cell).getByRole("button", { name: `${title} · 9am – 9:15am · Gala` }));
    expect(within(screen.getByRole("dialog")).getByRole("heading", { name: title })).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText(/9am – 9:15am/)).toBeTruthy();
  });

  it("leads an event day to its run sheet and a load-in day to the run sheet first", () => {
    const { cell } = renderCalendar();
    fireEvent.click(within(cell()).getByRole("button", { name: /^Gala/ }));
    expect(within(screen.getByRole("dialog")).getByRole("link", { name: "Open run sheet" }).getAttribute("href")).toBe("/dashboard/events/evt_1/run-sheet?dayId=day_main");
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Open event" })).toBeTruthy();
    cleanup();

    render(
      <EventCalendarWorkspace
        items={[{ ...entry("d0", "schedule_day", "overview", "Load-in", "Gala"), scheduleDayId: "day_0" }]}
        onRangeChange={vi.fn()}
        onOpenItem={vi.fn()}
      />,
    );
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
