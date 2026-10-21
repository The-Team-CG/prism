/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { PrismPmcmSupplierReadinessBoard, PrismPmcmSupplierReadinessItem } from "@prism/types";
import { PmcmSupplierReadinessBoard } from "./pmcm-supplier-readiness-board";

const { repository } = vi.hoisted(() => ({ repository: { get: vi.fn() } }));
vi.mock("../data/pmcm-supplier-readiness-repository", () => ({ pmcmSupplierReadinessRepository: repository }));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function item(overrides: Partial<PrismPmcmSupplierReadinessItem> = {}): PrismPmcmSupplierReadinessItem {
  return {
    id: "supplier-readiness:qr_sonic",
    requestId: "qr_sonic",
    eventId: "evt_1",
    supplierName: "Sonic Line",
    category: "Technicals",
    quoteStatus: "selected",
    assignmentStatus: "confirmed",
    readinessStatus: "confirmed",
    contractStatus: "changes_requested",
    eventDayStatus: "not_started",
    verificationStatus: "rejected",
    schedule: {
      ingressAt: "2026-10-02T04:00:00.000Z", egressAt: "2026-10-02T15:00:00.000Z", location: "Bay 2", status: "planned",
      revision: 3, acknowledged: false, acknowledgedAt: null, changeRequestNote: "Move ingress to 10:00", changeRequestedAt: "2026-09-30T00:00:00.000Z",
    },
    ingressLate: true,
    setupStatus: "late",
    concerns: [
      { kind: "schedule_change_request", message: "Move ingress to 10:00", at: "2026-09-30T00:00:00.000Z" },
      { kind: "contract_correction", message: "Missing insurance page", at: null },
    ],
    priority: "critical",
    dueAt: null,
    quoteLocked: true,
    pmcmReview: { verificationNotes: "Rigging unsafe at last walk", verifiedBy: "Francis", verifiedAt: null, readinessNotes: "" },
    ...overrides,
  };
}

function board(items: PrismPmcmSupplierReadinessItem[]): PrismPmcmSupplierReadinessBoard {
  return { generatedAt: "2026-10-02T05:00:00.000Z", eventId: "evt_1", counts: { critical: 1, warning: 0, attention: 0, info: 0 }, items };
}

describe("PmcmSupplierReadinessBoard", () => {
  it("renders the server readiness item with ingress, concerns, setup, and PMCM-only review notes", async () => {
    repository.get.mockResolvedValue(board([item()]));

    render(<PmcmSupplierReadinessBoard eventId="evt_1" />);

    expect(await screen.findByText("Sonic Line")).toBeTruthy();
    expect(repository.get).toHaveBeenCalledWith("evt_1");
    expect(screen.getByText("Quote locked")).toBeTruthy();
    expect(screen.getByText("Ingress late")).toBeTruthy();
    expect(screen.getByText(/revision 3 not acknowledged/)).toBeTruthy();
    expect(screen.getByRole("list", { name: "Sonic Line concerns" }).textContent).toContain("Missing insurance page");
    expect(screen.getByText(/Rigging unsafe at last walk/)).toBeTruthy();
    expect(screen.queryByText(/Do not advance planning/)).toBeNull();
  });

  it("keeps the category-gap hard block when no request in a category has a locked quote", async () => {
    repository.get.mockResolvedValue(board([
      item(),
      item({ id: "supplier-readiness:qr_cater", requestId: "qr_cater", supplierName: "Open Bid", category: "Catering", quoteStatus: "open", quoteLocked: false, concerns: [] }),
    ]));

    render(<PmcmSupplierReadinessBoard eventId="evt_1" />);

    expect(await screen.findByText("Do not advance planning until a supplier is selected in: Catering.")).toBeTruthy();
  });

  it("refetches when planner state changes and surfaces a forbidden read without stale rows", async () => {
    repository.get.mockResolvedValueOnce(board([item()]));
    const view = render(<PmcmSupplierReadinessBoard eventId="evt_1" refreshKey="a" />);
    expect(await screen.findByText("Sonic Line")).toBeTruthy();

    repository.get.mockRejectedValueOnce(new Error("coordinator cannot access PMCM supplier readiness board"));
    view.rerender(<PmcmSupplierReadinessBoard eventId="evt_1" refreshKey="b" />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("cannot access"));
    expect(repository.get).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Sonic Line")).toBeNull();
  });
});
