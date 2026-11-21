import { describe, expect, it } from "vitest";
import type { PrismPmcmSupplierWorkflowWorkspace } from "@prism/types";
import { summarizeSupplierWorkflow } from "./supplier-workflow-summary";

const row = (overrides: Partial<PrismPmcmSupplierWorkflowWorkspace> = {}) => ({
  requestId: "req_1", eventId: "evt_1", supplierId: "sup_1", supplierName: "Frame and Co.", assignmentStatus: "confirmed",
  schedule: null, contracts: [], creativeTasks: [], payables: [], ...overrides,
}) as PrismPmcmSupplierWorkflowWorkspace;

describe("summarizeSupplierWorkflow", () => {
  it("flags a booking with no schedule as waiting on PMCM and says nothing else exists yet", () => {
    const summary = summarizeSupplierWorkflow(row());
    expect(summary.schedule).toEqual({ text: "Not set", tone: "attention" });
    expect(summary.contract).toEqual({ text: "None yet", tone: "idle" });
    expect(summary.deliverables.text).toBe("None");
    expect(summary.payables.text).toBe("No milestones");
    expect(summary.needsPmcm).toBe(true);
  });

  it("reads the newest contract, deliverables to review and money released", () => {
    const summary = summarizeSupplierWorkflow(row({
      schedule: { ingressAt: "2026-12-06T22:00:00.000Z", egressAt: "2026-12-07T14:00:00.000Z", location: "BGC", revision: 1 } as never,
      contracts: [{ version: 1, reviewStatus: "changes_requested" }, { version: 2, reviewStatus: "accepted" }] as never,
      creativeTasks: [{ status: "submitted" }, { status: "accepted" }, { status: "cancelled" }] as never,
      payables: [{ amount: 400_000, amountReleased: 400_000, status: "released" }, { amount: 430_000, amountReleased: 0, status: "scheduled" }] as never,
    }));
    expect(summary.contract).toEqual({ text: "v2 accepted", tone: "done" });
    expect(summary.deliverables).toEqual({ text: "1 to review", tone: "attention" });
    expect(summary.payables.text).toBe("₱400,000 of ₱830,000");
    expect(summary.schedule.tone).toBe("done");
  });

  it("calls out a contract whose total differs from the selected quote", () => {
    expect(summarizeSupplierWorkflow(row({ contracts: [{ version: 3, reviewStatus: "accepted", quoteMismatch: true }] as never })).contract)
      .toEqual({ text: "v3 differs from quote", tone: "attention" });
  });
});
