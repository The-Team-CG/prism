/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismEventSchedule } from "@prism/types";

vi.mock("./live-ops-run-sheet", () => ({ LiveOpsRunSheet: () => <p>run sheet</p> }));

import { LiveOpsControlSurface } from "./live-ops-control-surface";

afterEach(() => cleanup());

describe("LiveOpsControlSurface", () => {
  it("says once that there is no schedule and where to author it, instead of repeating itself", () => {
    render(<LiveOpsControlSurface eventId="evt_1" schedule={{ authored: false } as PrismEventSchedule} />);
    expect(screen.getAllByText(/schedule/i).filter((node) => /no schedule/i.test(node.textContent ?? ""))).toHaveLength(1);
    expect(screen.getByText(/Schedule and reports/)).toBeTruthy();
    expect(screen.queryByText("run sheet")).toBeNull();
  });

  it("shows the run sheet and its status once a schedule is authored", () => {
    render(<LiveOpsControlSurface eventId="evt_1" schedule={{ authored: true } as PrismEventSchedule} />);
    expect(screen.getByText("Schedule loaded")).toBeTruthy();
    expect(screen.getByText("run sheet")).toBeTruthy();
    expect(screen.queryByText(/No schedule/i)).toBeNull();
  });
});
