/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PrismEventRunSheet, PrismRunSheetEntry } from "@prism/types";
import { buildRunSheetTimeline } from "../model/run-sheet-timeline";
import { LiveOpsRunSheet, LiveOpsRunSheetView, type LiveOpsRunSheetViewProps } from "./live-ops-run-sheet";

const { repository } = vi.hoisted(() => ({ repository: { getRunSheet: vi.fn() } }));
vi.mock("../data/live-ops-schedule-repository", () => ({ liveOpsScheduleRepository: repository }));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function entry(overrides: Partial<PrismRunSheetEntry> & Pick<PrismRunSheetEntry, "id" | "kind" | "at" | "title">): PrismRunSheetEntry {
  return { endAt: null, status: "planned", ownerLabel: "", location: "", referenceId: overrides.id, severity: null, carriedOver: false, ...overrides };
}

function runSheetFixture(overrides: Partial<PrismEventRunSheet> = {}): PrismEventRunSheet {
  return {
    eventId: "evt_1",
    scope: "pmcm",
    generatedAt: "2026-08-20T08:00:00.000Z",
    day: { id: "day_1", eventId: "evt_1", dayDate: "2026-08-20", label: "Main day", status: "active", segments: [] },
    days: [{ id: "day_1", dayDate: "2026-08-20", label: "Main day" }, { id: "day_2", dayDate: "2026-08-21", label: "Load-out" }],
    supplierWindowsVisible: true,
    entries: [
      entry({ id: "issue:i1", kind: "issue", at: "2026-08-19T20:00:00.000Z", title: "Generator fault", status: "open", severity: "critical", carriedOver: true }),
      entry({ id: "ingress:s1", kind: "ingress", at: "2026-08-20T09:00:00.000Z", title: "Lights Co ingress", ownerLabel: "Technicals", location: "Dock B" }),
      entry({ id: "segment:seg1", kind: "segment", at: "2026-08-20T10:00:00.000Z", endAt: "2026-08-20T11:00:00.000Z", title: "Opening program", ownerLabel: "Floor Director", status: "planned" }),
      entry({ id: "task_due:t1", kind: "task_due", at: "2026-08-20T12:00:00.000Z", title: "Radio check", status: "open", severity: "high" }),
    ],
    coordinators: [],
    supplierCommitments: [],
    openTasks: [],
    openIssues: [],
    ...overrides,
  };
}

function renderView(runSheet: PrismEventRunSheet, now: Date, overrides: Partial<LiveOpsRunSheetViewProps> = {}) {
  return render(
    <LiveOpsRunSheetView
      runSheet={runSheet}
      timeline={buildRunSheetTimeline(runSheet.entries, now)}
      unavailable={false}
      loading={false}
      error={null}
      now={now}
      onSelectDay={vi.fn()}
      onReload={vi.fn()}
      {...overrides}
    />,
  );
}

describe("LiveOpsRunSheetView", () => {
  it("renders entries in server order with a now marker and highlights what is overdue", () => {
    renderView(runSheetFixture(), new Date("2026-08-20T10:30:00.000Z"));

    const list = screen.getByRole("list", { name: "Run sheet entries" });
    const rows = Array.from(list.children);
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);
    expect(rows.map((row) => row.getAttribute("data-kind") ?? "now")).toEqual(["issue", "ingress", "segment", "now", "task_due"]);
    expect(screen.getByRole("separator", { name: "Now" })).toBeTruthy();
    // Supplier ingress still planned after its time, and the program not started, are overdue; the future task is not.
    expect(rows.filter((row) => row.getAttribute("data-overdue") === "true").map((row) => row.getAttribute("data-kind"))).toEqual(["ingress", "segment"]);
    expect(screen.getByText(/Carried over from/)).toBeTruthy();
    expect(screen.getByText(/Supplier ingress · Technicals · Dock B/)).toBeTruthy();
  });

  it("explains the coordinator projection and withheld supplier windows", () => {
    renderView(
      runSheetFixture({ scope: "coordinator", supplierWindowsVisible: false, entries: [] }),
      new Date("2026-08-20T08:00:00.000Z"),
    );

    expect(screen.getByText(/Showing what your assignment allows/)).toBeTruthy();
    expect(screen.getByText("Supplier ingress and egress windows are not shared with this role.")).toBeTruthy();
    expect(screen.getByText("Nothing is scheduled for this day yet.")).toBeTruthy();
  });

  it("offers printing only in the printable layout", () => {
    const onPrint = vi.fn();
    renderView(runSheetFixture(), new Date("2026-08-20T08:00:00.000Z"), { printable: true, onPrint });

    fireEvent.click(screen.getByRole("button", { name: "Print run sheet" }));
    expect(onPrint).toHaveBeenCalledTimes(1);
    cleanup();

    renderView(runSheetFixture(), new Date("2026-08-20T08:00:00.000Z"));
    expect(screen.queryByRole("button", { name: "Print run sheet" })).toBeNull();
  });
});

describe("LiveOpsRunSheet", () => {
  it("loads the event run sheet and reloads the selected schedule day", async () => {
    repository.getRunSheet.mockResolvedValue(runSheetFixture());

    render(<LiveOpsRunSheet eventId="evt_1" />);

    expect(await screen.findByText("Opening program")).toBeTruthy();
    expect(repository.getRunSheet).toHaveBeenCalledWith("evt_1", undefined);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "day_2" } });
    await waitFor(() => expect(repository.getRunSheet).toHaveBeenLastCalledWith("evt_1", "day_2"));
  });

  it("tells the team when no schedule has been authored", async () => {
    repository.getRunSheet.mockResolvedValue({ eventId: "evt_1", authored: false, reason: "no_schedule" });

    render(<LiveOpsRunSheet eventId="evt_1" />);

    expect(await screen.findByText("No run sheet is available until the event schedule is authored.")).toBeTruthy();
  });
});
