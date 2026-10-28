/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PrismHandoffBrief } from "@prism/types";
import { HandoffBriefPanel } from "./handoff-brief-panel";

const { repository } = vi.hoisted(() => ({ repository: { get: vi.fn() } }));
vi.mock("../data/handoff-brief-repository", () => ({ handoffBriefRepository: repository }));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function briefFixture(overrides: Partial<PrismHandoffBrief> = {}): PrismHandoffBrief {
  return {
    eventId: "evt_1",
    scope: "pmcm",
    generatedAt: "2026-10-02T00:00:00.000Z",
    keyDetails: { eventId: "evt_1", eventName: "Ayala Summit", eventDate: "2026-10-02", status: "planning", archived: false, venue: "Ayala Hall", guestCount: 180, walkInPolicy: "closed", clientName: "Ana Reyes" },
    schedule: { eventId: "evt_1", authored: false, days: [], serverTime: "2026-10-02T00:00:00.000Z" },
    supplierReadiness: {
      visible: true,
      items: [{ id: "q1", supplierName: "Sonic Line", category: "Technicals", assignmentStatus: "confirmed", readinessStatus: "ready", eventDayStatus: "set_up_ready", verificationStatus: "verified" }],
    },
    staffing: [{ id: "a1", coordinatorName: "Rhea Santos", role: "Floor Director", status: "acknowledged", attendanceStatus: "present" }],
    openIssues: [{ id: "i1", title: "Generator fault", description: "", severity: "high", status: "open", affectedArea: "Main Stage", ownerRole: "coordinator", ownerName: "", slaStatus: "due_soon" }],
    files: [{ key: "official_floorplan", label: "Official floorplan", ownerRole: "pmcm-admin", status: "approved", dueDate: null }],
    handoffs: [{ id: "h1", eventId: "evt_1", dayId: "d1", role: "Floor Director", fromAssignmentId: "a0", toAssignmentId: "a1", handedOffBy: "Francis", receivedBy: "Rhea Santos", handedOffAt: "2026-10-02T10:00:00.000Z", outstandingItems: ["Radio check"] }],
    ...overrides,
  };
}

describe("HandoffBriefPanel", () => {
  it("renders PMCM brief sections including client, issues, files and the latest handoff items", async () => {
    repository.get.mockResolvedValue(briefFixture());

    render(<HandoffBriefPanel eventId="evt_1" />);

    expect(await screen.findByText("Ana Reyes")).toBeTruthy();
    expect(screen.getByText("Generator fault")).toBeTruthy();
    expect(screen.getByText("Official floorplan")).toBeTruthy();
    expect(screen.getByText("Radio check")).toBeTruthy();
    expect(screen.getByText(/Sonic Line/)).toBeTruthy();
    expect(repository.get).toHaveBeenCalledWith("evt_1");
  });

  it("shows the coordinator subset without client identity and explains withheld supplier readiness", async () => {
    repository.get.mockResolvedValue(
      briefFixture({
        scope: "coordinator",
        keyDetails: { ...briefFixture().keyDetails, clientName: null },
        supplierReadiness: { visible: false, items: [] },
      }),
    );

    render(<HandoffBriefPanel eventId="evt_1" />);

    expect(await screen.findByText("Supplier readiness is not shared with this role.")).toBeTruthy();
    expect(screen.queryByText("Ana Reyes")).toBeNull();
    expect(screen.queryByText("Sonic Line", { exact: false })).toBeNull();
  });

  it("surfaces load failures without rendering a stale brief", async () => {
    repository.get.mockRejectedValue(new Error("Coordinator is not assigned to this event"));

    render(<HandoffBriefPanel eventId="evt_1" />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not assigned"));
    expect(screen.queryByText("Ayala Summit")).toBeNull();
  });

  it("starts collapsed on the live desk with a counted summary and expands on request", async () => {
    repository.get.mockResolvedValue(briefFixture());

    render(<HandoffBriefPanel eventId="evt_1" />);

    expect(await screen.findByText("1 open issues · 0 files outstanding · 1 items from the latest handoff")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "Show brief" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect((document.getElementById("handoff-brief-body") as HTMLElement).hidden).toBe(true);

    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Hide brief" }).getAttribute("aria-expanded")).toBe("true");
    expect((document.getElementById("handoff-brief-body") as HTMLElement).hidden).toBe(false);
  });
});
