import { describe, expect, it } from "vitest";
import {
  approvalStatusKind,
  buildApprovalItems,
  filterApprovalItems,
} from "./client-approvals-rules";
import type { PrismBillingStatement, PrismDocument, PrismEvent, PrismFloorPlanDraft } from "@prism/types";

function event(overrides: Partial<PrismEvent> = {}): PrismEvent {
  return {
    id: "evt-1",
    eventName: "Summit",
    clientName: "Ana",
    status: "planning",
    ...overrides,
  } as PrismEvent;
}

describe("client-approvals-rules", () => {
  it("returns no items without a selected event", () => {
    expect(buildApprovalItems(undefined, [])).toEqual([]);
  });

  it("marks contracts approved when matching documents exist", () => {
    const documents = [{ id: "d1", type: "conforme", status: "uploaded" }] as PrismDocument[];
    const items = buildApprovalItems(event(), documents);
    expect(items.find((item) => item.title === "Contracts")).toMatchObject({ title: "Contracts", status: "approved" });
  });

  it("filters pending vs approved views", () => {
    const items = buildApprovalItems(event({ readiness: "confirmed" }), [], undefined, {
      status: "approved",
    } as PrismFloorPlanDraft);
    const pending = filterApprovalItems(items, "approvals-pending");
    const approved = filterApprovalItems(items, "approvals-approved");
    expect(pending.every((item) => item.status !== "approved")).toBe(true);
    expect(approved.every((item) => item.status === "approved")).toBe(true);
  });

  it("filters named approval categories", () => {
    const items = buildApprovalItems(event(), [], { number: "B-1", status: "issued" } as PrismBillingStatement);
    expect(filterApprovalItems(items, "approvals-quotations").map((item) => item.title)).toEqual(["Quotations"]);
    expect(filterApprovalItems(items, "approvals-contracts").map((item) => item.title)).toEqual(["Contracts"]);
  });

  it("classifies status icons", () => {
    expect(approvalStatusKind("approved")).toBe("success");
    expect(approvalStatusKind("pending review")).toBe("pending");
    expect(approvalStatusKind("in_review")).toBe("neutral");
  });

  it("offers review only for an issued, open proposal and puts it first", () => {
    const pendingEvent = event({ clientPortalStatus: "unlocked", proposalClientStatus: "pending" });
    const issued = [{ id: "proposal-1", type: "proposal", status: "issued", uploadedAt: "2026-11-12T00:00:00Z" }] as PrismDocument[];
    expect(buildApprovalItems(pendingEvent, []).some((item) => item.actionable)).toBe(false);
    const open = buildApprovalItems(pendingEvent, issued);
    expect(open.filter((item) => item.actionable).map((item) => item.title)).toEqual(["Proposal"]);
    expect(filterApprovalItems([...open].reverse())[0].title).toBe("Proposal");
    expect(buildApprovalItems({ ...pendingEvent, proposalClientStatus: "approved" }, issued).some((item) => item.actionable)).toBe(false);
    expect(buildApprovalItems({ ...pendingEvent, archived: true }, issued).some((item) => item.actionable)).toBe(false);
  });
});
