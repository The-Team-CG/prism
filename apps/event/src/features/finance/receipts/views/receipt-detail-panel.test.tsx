/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { PrismPaymentReceipt } from "@prism/types";
import { ReceiptDetailPanel } from "./receipt-detail-panel";

const { downloadEvidence } = vi.hoisted(() => ({ downloadEvidence: vi.fn() }));
vi.mock("../data/receipts-repository", () => ({ receiptsRepository: { downloadEvidence } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function receipt(overrides: Partial<PrismPaymentReceipt> = {}): PrismPaymentReceipt {
  return {
    id: "prcp_1", amount: 66000, receivedDate: "2026-11-14", method: "Bank Transfer", referenceNumber: "BPI-1114-7781", payerName: "Ana Reyes", eventId: "evt_1", notes: "",
    status: "recorded", source: "client", intendedMilestoneId: "m2", intendedMilestoneLabel: "Second payment", legacy: false, evidenceObjectId: "obj_1",
    evidence: { objectId: "obj_1", fileName: "transfer.png", contentType: "image/png", byteSize: 48213 }, verifiedAt: null, verifiedBy: null, verificationNotes: null,
    rejectionReason: null, reversalReason: null, possibleDuplicateOfId: null, applied: 0, refunded: 0, unapplied: 66000, allocations: [], refunds: [], recordedBy: "Ana Reyes",
    recordedAt: "2026-11-14T01:00:00.000Z", ...overrides,
  };
}

function renderPanel(selected: PrismPaymentReceipt) {
  render(<ReceiptDetailPanel vm={{ selected, openEvidence: vi.fn(), openDialog: vi.fn() } as never} />);
}

describe("receipt details", () => {
  it("shows the client's proof inline with Verify first, so PMCM checks it without downloading", async () => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:proof"), revokeObjectURL: vi.fn() });
    downloadEvidence.mockResolvedValue({ blob: new Blob(["png"]), fileName: "transfer.png" });
    renderPanel(receipt());

    const image = await screen.findByRole("img", { name: "Proof of payment: transfer.png" });
    expect(image.getAttribute("src")).toBe("blob:proof");
    expect(downloadEvidence).toHaveBeenCalledWith("obj_1");
    expect(screen.getByText("Reported by the client for Second payment, with proof.")).toBeTruthy();
    const actions = screen.getAllByRole("button").map((button) => button.textContent);
    expect(actions.indexOf("Verify")).toBeLessThan(actions.indexOf("Apply to a milestone"));
    vi.unstubAllGlobals();
  });

  it("says plainly when a proof cannot be loaded, and asks for proof when none is attached", async () => {
    downloadEvidence.mockRejectedValue(new Error("Stored object is outside the actor role scope"));
    renderPanel(receipt());
    expect(await screen.findByText("Stored object is outside the actor role scope")).toBeTruthy();
    cleanup();

    renderPanel(receipt({ evidence: null, evidenceObjectId: null }));
    const section = screen.getByText("Proof of payment").closest("section") as HTMLElement;
    expect(within(section).getByText(/No proof is attached yet/)).toBeTruthy();
    expect(downloadEvidence).toHaveBeenCalledTimes(1);
  });
});
