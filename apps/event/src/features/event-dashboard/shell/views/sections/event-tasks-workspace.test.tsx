/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { PrismEvent } from "@prism/types";
import { EventTasksWorkspace } from "./event-tasks-workspace";

const event = { id: "evt-gala", eventName: "Founders gala" } as PrismEvent;

function renderTasks(selectedEvent?: PrismEvent) {
  render(
    <EventTasksWorkspace
      unreviewedInquiries={1}
      pendingApprovals={[]}
      selectedEvent={selectedEvent}
      ocularVisit={null}
      isAdmin={false}
      busy={false}
      onScheduleOcularVisit={vi.fn()}
      onCompleteOcularVisit={vi.fn()}
      onWaiveOcularVisit={vi.fn()}
      defenseReadiness={null}
      commandInbox={null}
      draftsCount={2}
      quoteCount={3}
      paymentCount={1}
      openCheckCount={0}
      onNavigateSection={vi.fn()}
      onNavigateEventTab={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("EventTasksWorkspace without a selected event", () => {
  it("asks for an event instead of reporting that there are no blockers", () => {
    renderTasks();

    expect(screen.getByText("Select an event")).toBeTruthy();
    expect(screen.queryByText("No open blockers")).toBeNull();
  });

  it("offers only the queue rows that do not depend on an event", () => {
    renderTasks();

    expect(screen.getByText("Review client inquiries")).toBeTruthy();
    expect(screen.getByText("Approve portal accounts")).toBeTruthy();
    expect(screen.queryByText("Check floorplan drafts")).toBeNull();
    expect(screen.queryByText("Review supplier coverage")).toBeNull();
    expect(screen.queryByText("Check billing milestones")).toBeNull();
    expect(screen.queryByText("Resolve closeout gates")).toBeNull();
    expect(screen.queryByText("Select an event workspace.")).toBeNull();
  });
});

describe("EventTasksWorkspace with a selected event", () => {
  it("lists the event's queue rows with their counts", () => {
    renderTasks(event);

    expect(screen.getByText("Check floorplan drafts")).toBeTruthy();
    expect(screen.getByText("2 draft(s) for Founders gala.")).toBeTruthy();
    expect(screen.getByText("No open blockers")).toBeTruthy();
    expect(screen.queryByText("Select an event")).toBeNull();
  });
});
