import { describe, expect, it, vi } from "vitest";
import {
  submitAdditionalBilling,
  submitAdditionalBillingWaiver,
  submitBillingCorrection,
  submitBillingDispute,
  submitDisputeResolution,
} from "./submit-billing-adjustment";

type Body = Record<string, unknown>;

function createWriter() {
  return {
    createDispute: vi.fn(async (_eventId: string, _body: Body) => ({ id: "dispute_1" })),
    resolveDispute: vi.fn(async (_eventId: string, _disputeId: string, _body: Body) => ({ id: "dispute_1", status: "resolved" })),
    createCorrection: vi.fn(async (_eventId: string, _body: Body) => ({ id: "corr_1" })),
    createAdditionalBilling: vi.fn(async (_eventId: string, _body: Body) => ({ id: "addbill_1" })),
    waiveAdditionalBilling: vi.fn(async (_eventId: string, _additionalBillingId: string, _body: Body) => ({ id: "addbill_1", status: "waived" })),
  };
}

describe("billing adjustment use cases", () => {
  it("blocks a waiver without a reason before any request is sent", async () => {
    const writer = createWriter();

    await expect(submitAdditionalBillingWaiver(writer, "evt_1", "addbill_1", "   ")).rejects.toThrow("Waiver reason is required.");

    expect(writer.waiveAdditionalBilling).not.toHaveBeenCalled();
  });

  it("sends a waiver with a non-blank reason to the owning event", async () => {
    const writer = createWriter();

    await submitAdditionalBillingWaiver(writer, "evt_1", "addbill_1", "Client accepted the overtime credit");

    expect(writer.waiveAdditionalBilling).toHaveBeenCalledWith("evt_1", "addbill_1", { reason: "Client accepted the overtime credit" });
  });

  it("refuses a dispute above the statement total and never reaches the writer", async () => {
    const writer = createWriter();

    await expect(submitBillingDispute(writer, "evt_1", {
      statementId: "stmt_1",
      amount: 100001,
      reason: "Unapproved charge",
      statementTotal: 100000,
    })).rejects.toThrow("Disputed amount cannot exceed the statement total.");

    expect(writer.createDispute).not.toHaveBeenCalled();
  });

  it("sends a dispute with a fresh idempotency key and no client-side total field", async () => {
    const writer = createWriter();

    await submitBillingDispute(writer, "evt_1", {
      statementId: "stmt_1",
      milestoneId: "pay_balance",
      amount: 20000,
      reason: "Unapproved charge",
      statementTotal: 100000,
    });

    const [eventId, body] = writer.createDispute.mock.calls[0];
    expect(eventId).toBe("evt_1");
    expect(body).toMatchObject({ statementId: "stmt_1", milestoneId: "pay_balance", amount: 20000, reason: "Unapproved charge" });
    expect(body).not.toHaveProperty("statementTotal");
    expect(typeof body.idempotencyKey).toBe("string");
  });

  it("requires notes when rejecting a dispute resolution", async () => {
    const writer = createWriter();

    await expect(submitDisputeResolution(writer, "evt_1", "dispute_1", { action: "reject", resolutionNotes: "" })).rejects.toThrow();
    expect(writer.resolveDispute).not.toHaveBeenCalled();
  });

  it("blocks a correction without a reason", async () => {
    const writer = createWriter();

    await expect(submitBillingCorrection(writer, "evt_1", { statementId: "stmt_1", reason: " " })).rejects.toThrow("Correction reason is required.");
    expect(writer.createCorrection).not.toHaveBeenCalled();
  });

  it("requires additional billing to name an approved source and an urgent issue", async () => {
    const writer = createWriter();

    await expect(submitAdditionalBilling(writer, "evt_1", {
      urgentIssueId: "issue_1",
      billingSourceId: "   ",
      description: "Overtime",
      amount: 5000,
    })).rejects.toThrow();
    expect(writer.createAdditionalBilling).not.toHaveBeenCalled();

    await submitAdditionalBilling(writer, "evt_1", {
      urgentIssueId: "issue_1",
      billingSourceId: "bsrc_approved",
      description: "Overtime",
      amount: 5000,
    });
    expect(writer.createAdditionalBilling).toHaveBeenCalledTimes(1);
  });
});
