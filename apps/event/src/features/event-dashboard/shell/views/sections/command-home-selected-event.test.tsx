/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PrismEvent } from "@prism/types";
import { CommandHomeSelectedEvent } from "./command-home-selected-event";

const event = { id: "evt_gala", eventName: "Ayala Gala", clientName: "Ana Reyes" } as PrismEvent;

describe("CommandHomeSelectedEvent", () => {
  it("summarizes the selected event and links to its workspace", () => {
    const onOpenEvent = vi.fn();
    render(
      <CommandHomeSelectedEvent
        event={event}
        drafts={[]}
        quoteRequestCount={2}
        quoteCount={3}
        openCheckCount={1}
        onOpenEvent={onOpenEvent}
        onBrowseEvents={vi.fn()}
      />,
    );

    expect(screen.getByText("Ayala Gala")).toBeTruthy();
    expect(screen.getByText("Official layout")).toBeTruthy();
    expect(screen.getByText("Closure checks")).toBeTruthy();
    expect(screen.queryByText("Active events")).toBeNull();
    const open = screen.getByRole("link", { name: /Open workspace/ });
    // A real address, so PMCM can open the workspace in a new tab or copy its link.
    expect(open.getAttribute("href")).toBe("/dashboard/events/evt_gala/overview");
    // Modified clicks are left to the browser; a plain click stays in the app.
    fireEvent.click(open, { ctrlKey: true });
    expect(onOpenEvent).not.toHaveBeenCalled();
    fireEvent.click(open);
    expect(onOpenEvent).toHaveBeenCalledWith("evt_gala");
  });

  it("offers a way to pick an event instead of generic totals when none is selected", () => {
    const onBrowseEvents = vi.fn();
    render(
      <CommandHomeSelectedEvent
        drafts={[]}
        quoteRequestCount={0}
        quoteCount={0}
        openCheckCount={0}
        onOpenEvent={vi.fn()}
        onBrowseEvents={onBrowseEvents}
      />,
    );

    expect(screen.getByText("No event selected")).toBeTruthy();
    const browse = screen.getByRole("link", { name: "Browse events" });
    expect(browse.getAttribute("href")).toBe("/dashboard/events");
    fireEvent.click(browse);
    expect(onBrowseEvents).toHaveBeenCalled();
  });
});
