/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismCoordinatorRoleView } from "@prism/types";
import { CoordinatorTimelineCard } from "./coordinator-view-sections";

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
