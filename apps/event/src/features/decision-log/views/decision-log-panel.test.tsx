/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PRISM_DECISION_LOG_KINDS, type PrismDecisionLog, type PrismDecisionLogEntry, type PrismDecisionLogKind } from "@prism/types";
import { DecisionLogPanel } from "./decision-log-panel";

const { repository } = vi.hoisted(() => ({ repository: { load: vi.fn() } }));
vi.mock("../data/decision-log-repository", () => ({ decisionLogRepository: repository }));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function entry(kind: PrismDecisionLogKind, overrides: Partial<PrismDecisionLogEntry> = {}): PrismDecisionLogEntry {
  return {
    id: `${kind}:1`,
    kind,
    decision: "archived_with_override",
    subject: "Event archived with open close gates",
    reason: "Asset returns verified offline",
    actor: { name: "Ms. Mys", role: "pmcm-admin" },
    decidedAt: "2026-09-13T09:00:00.000Z",
    sourceRef: { type: "event", id: "evt_1" },
    ...overrides,
  };
}

function log(entries: PrismDecisionLogEntry[], overrides: Partial<PrismDecisionLog> = {}): PrismDecisionLog {
  const kindCounts = Object.fromEntries(PRISM_DECISION_LOG_KINDS.map((kind) => [kind, 0])) as PrismDecisionLog["kindCounts"];
  kindCounts.archive_override = 1;
  kindCounts.ocular_waiver = 1;
  return {
    eventId: "evt_1",
    generatedAt: "2026-09-14T00:00:00.000Z",
    kind: null,
    page: { index: 0, size: 25, total: entries.length, hasMore: false },
    kindCounts,
    entries,
    ...overrides,
  };
}

describe("DecisionLogPanel", () => {
  it("renders each decision with its reason, attributed actor, and source record", async () => {
    repository.load.mockResolvedValue(
      log([entry("archive_override"), entry("ocular_waiver", { id: "ocular_waiver:1", decision: "waived", subject: "Ocular visit waived", reason: null, actor: { name: "Francis", role: null } })]),
    );

    render(<DecisionLogPanel eventId="evt_1" />);

    expect(await screen.findByText("Archive override: archived with override")).toBeTruthy();
    expect(screen.getByText("Reason: Asset returns verified offline")).toBeTruthy();
    expect(screen.getByText(/Ms\. Mys \(pmcm-admin\) · Source event evt_1/)).toBeTruthy();
    expect(screen.getByText("No reason recorded.")).toBeTruthy();
    expect(screen.getByText(/^Francis · Source/)).toBeTruthy();
    expect(repository.load).toHaveBeenCalledWith("evt_1", { page: 0, pageSize: 25 });
  });

  it("offers only kinds with recorded decisions and reloads from page one for the chosen kind", async () => {
    repository.load.mockResolvedValue(log([entry("archive_override")], { page: { index: 0, size: 25, total: 30, hasMore: true } }));
    render(<DecisionLogPanel eventId="evt_1" />);
    await screen.findByText("Archive override: archived with override");

    const select = screen.getByLabelText("Filter by kind") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual(["all", "archive_override", "ocular_waiver"]);

    fireEvent.click(screen.getByRole("button", { name: "Older" }));
    await waitFor(() => expect(repository.load).toHaveBeenLastCalledWith("evt_1", { page: 1, pageSize: 25 }));

    repository.load.mockResolvedValue(log([], { kind: "ocular_waiver" }));
    fireEvent.change(select, { target: { value: "ocular_waiver" } });

    await waitFor(() => expect(repository.load).toHaveBeenLastCalledWith("evt_1", { kind: "ocular_waiver", page: 0, pageSize: 25 }));
    expect(await screen.findByText("No ocular visit waiver decisions recorded.")).toBeTruthy();
  });

  it("surfaces a refused read without rendering stale decisions", async () => {
    repository.load.mockRejectedValue(new Error("coordinator cannot access PMCM decision log"));

    render(<DecisionLogPanel eventId="evt_1" />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("cannot access PMCM decision log"));
    expect(screen.queryByRole("list")).toBeNull();
  });
});
