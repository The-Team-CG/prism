/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PrismEvent } from "@prism/types";
import { CommandHomeSelectedEvent } from "./command-home-selected-event";

const event = { id: "evt_gala", eventName: "Ayala Gala", clientName: "Ana Reyes" } as PrismEvent;

describe("CommandHomeSelectedEvent", () => {
  it("summarizes the selected event and opens its workspace", () => {
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
    fireEvent.click(screen.getByRole("button", { name: /Open workspace/ }));
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
    fireEvent.click(screen.getByRole("button", { name: "Browse events" }));
    expect(onBrowseEvents).toHaveBeenCalled();
  });
});
