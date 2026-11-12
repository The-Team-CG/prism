/** @vitest-environment jsdom */
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { CoordinatorCalendar } from "./coordinator-calendar";
import type { CoordinatorCalendarItem } from "../model/coordinator-calendar-items";

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T00:00:00Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const task: CoordinatorCalendarItem = { id: "task", date: "2026-11-12", title: "Confirm load-in", detail: "Gala", kind: "task", eventId: "event-1", view: "tasks" };

it.each([
  { item: task, view: "Month" },
  { item: { ...task, startTime: "09:00" }, view: "Day" },
])("opens $view for the opening date and preserves the task action", ({ item, view }) => {
  const onOpen = vi.fn();
  render(<CoordinatorCalendar items={[item]} onOpen={onOpen} />);
  expect(screen.getByRole("button", { name: `Calendar view: ${view}` })).toBeTruthy();
  if (view === "Day") expect(screen.getByRole("region", { name: "Daily agenda" })).toBeTruthy();
  const cell = document.querySelector<HTMLElement>('[data-date="2026-11-12"]');
  if (!cell) throw new Error("The opening date was not rendered");
  fireEvent.click(within(cell).getByRole("button", { name: /Confirm load-in/ }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Open tasks" }));
  expect(onOpen).toHaveBeenCalledWith("tasks", "event-1");
});
