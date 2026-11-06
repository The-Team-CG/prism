/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { CoordinatorStatusSummary, CoordinatorTimelineCard } from "./coordinator-view-sections";

vi.mock("@/features/live-ops/schedule", () => ({ LiveOpsControlSurface: () => null, LiveOpsScheduleDesk: () => null }));
vi.mock("@/features/live-ops/handoff-brief", () => ({ HandoffBriefPanel: () => null }));

afterEach(cleanup);

describe("coordinator run sheet", () => {
  it("says PMCM has not published the run sheet and lets the coordinator check again", () => {
    const onCheckAgain = vi.fn();
    const roleView = { event: { id: "evt_1" }, schedule: { authored: false }, timer: null } as unknown as PrismCoordinatorRoleView;

    render(<CoordinatorTimelineCard roleView={roleView} onCheckAgain={onCheckAgain} />);

    expect(screen.getByText("PMCM hasn't published the run sheet for this event yet.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
  });
});

describe("coordinator stat cards", () => {
  it("opens the view behind each figure, reads zero check-ins as a sentence, and has no attendance card", () => {
    const onNavigate = vi.fn();
    const roleView = { supplierStatuses: [], guestAttendanceCount: 0 } as unknown as PrismCoordinatorRoleView;

    render(
      <CoordinatorStatusSummary
        activeDraft={null}
        roleViewLoading={false}
        roleView={roleView}
        roleDataStatus="ready"
        registrationRole={false}
        onNavigate={onNavigate}
      />,
    );

    expect(screen.queryByText("Your attendance")).toBeNull();
    expect(screen.getByText("No check-ins recorded")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Check-ins/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("issues");
    fireEvent.click(screen.getByRole("button", { name: /Supplier setup/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("tasks");
  });
});
