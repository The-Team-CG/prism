/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismBillingCorrection } from "@prism/types";
import { BillingAdjustmentsPanel } from "./billing-adjustments-panel";

const { loadBilling, resolveCorrection, readStoredEventSession } = vi.hoisted(() => ({
  loadBilling: vi.fn(),
  resolveCorrection: vi.fn(),
  readStoredEventSession: vi.fn(),
}));
vi.mock("@/app/lib/session", () => ({ readStoredEventSession }));
vi.mock("../data/billing-adjustment-repository", () => ({
  billingAdjustmentRepository: { loadBilling, resolveCorrection },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function correction(overrides: Partial<PrismBillingCorrection> = {}): PrismBillingCorrection {
  return {
    id: "corr_1",
    eventId: "evt_1",
    statementId: "bill_1",
    reason: "Tax line is incorrect",
    correctedTotalAmount: null,
    status: "pending",
    requestedBy: "Ms. Mys",
    requestedById: "usr_pmcm",
    resolvedBy: null,
    resolutionNotes: null,
    createdAt: "2026-10-10T00:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function renderPanelWith(corrections: PrismBillingCorrection[], viewer: { id: string; name: string }) {
  readStoredEventSession.mockReturnValue(viewer);
  loadBilling.mockResolvedValue({ billingCorrections: corrections, billingDisputes: [], additionalBillings: [] });
  render(<BillingAdjustmentsPanel eventId="evt_1" statements={[]} billingSources={[]} payments={[]} />);
}

function buttonFor(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("BillingAdjustmentsPanel correction approval", () => {
  it("blocks the requester from approving their own correction but keeps rejection available", async () => {
    renderPanelWith([correction()], { id: "usr_pmcm", name: "Ms. Mys" });

    await screen.findByText(/You requested this correction/);
    expect(buttonFor("Approve").disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText("Rejection reason (required to reject)"), { target: { value: "Withdrawing the request" } });
    expect(buttonFor("Reject").disabled).toBe(false);
    fireEvent.click(buttonFor("Reject"));

    await waitFor(() => expect(resolveCorrection).toHaveBeenCalledWith("evt_1", "corr_1", { action: "reject", resolutionNotes: "Withdrawing the request" }));
  });

  it("lets a different PMCM user approve the same correction", async () => {
    resolveCorrection.mockResolvedValue(correction({ status: "approved" }));
    renderPanelWith([correction()], { id: "usr_approver", name: "PMCM Approver" });

    await waitFor(() => expect(buttonFor("Approve").disabled).toBe(false));
    fireEvent.click(buttonFor("Approve"));

    await waitFor(() => expect(resolveCorrection).toHaveBeenCalledWith("evt_1", "corr_1", expect.objectContaining({ action: "approve" })));
  });

  it("matches legacy corrections without a requester id on the stored requester name", async () => {
    renderPanelWith([correction({ requestedById: null })], { id: "usr_pmcm", name: "Ms. Mys" });

    await screen.findByText(/You requested this correction/);
    expect(buttonFor("Approve").disabled).toBe(true);
  });
});
