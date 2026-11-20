import { describe, expect, it } from "vitest";
import { canWithdrawClientChangeRequest, clientChangeRequestStatusLabel } from "./client-change-request-rules";

describe("clientChangeRequestStatusLabel", () => {
  it("uses neutral client wording for each status", () => {
    expect(clientChangeRequestStatusLabel("under_review")).toBe("Under review");
    expect(clientChangeRequestStatusLabel("approved")).toBe("Approved");
    expect(clientChangeRequestStatusLabel("not_approved")).toBe("Not approved");
    expect(clientChangeRequestStatusLabel("withdrawn")).toBe("Withdrawn");
  });
});

describe("canWithdrawClientChangeRequest", () => {
  it("offers withdrawal only for a scope change PMCM has not picked up, never for a freeze exception", () => {
    expect(canWithdrawClientChangeRequest({ source: "scope_change", status: "under_review", withdrawable: true })).toBe(true);
    // PMCM has started reviewing it: still "under review" to the client, but the API no longer accepts a withdrawal.
    expect(canWithdrawClientChangeRequest({ source: "scope_change", status: "under_review", withdrawable: false })).toBe(false);
    expect(canWithdrawClientChangeRequest({ source: "scope_change", status: "approved", withdrawable: false })).toBe(false);
    expect(canWithdrawClientChangeRequest({ source: "freeze_exception", status: "under_review", withdrawable: false })).toBe(false);
  });
});
