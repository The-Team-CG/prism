/** @vitest-environment jsdom */
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEventDayTaskTarget } from "./use-event-day-task-target";

describe("useEventDayTaskTarget", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    window.location.hash = "";
  });

  it("scrolls the event-day task named by the hash into view", () => {
    const row = document.createElement("div");
    row.id = "event-day-task-task-1";
    row.scrollIntoView = vi.fn();
    document.body.appendChild(row);
    window.location.hash = "#event-day-task-task-1";

    renderHook(() => useEventDayTaskTarget());

    expect(row.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: "start" });
  });

  it("leaves the page alone for a hash that is not an event-day task", () => {
    const section = document.createElement("section");
    section.id = "live-ops-task-form";
    section.scrollIntoView = vi.fn();
    document.body.appendChild(section);
    window.location.hash = "#live-ops-task-form";

    renderHook(() => useEventDayTaskTarget());

    expect(section.scrollIntoView).not.toHaveBeenCalled();
  });
});
