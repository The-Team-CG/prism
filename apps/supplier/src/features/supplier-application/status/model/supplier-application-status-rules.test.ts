import { describe, expect, it } from "vitest";
import { PrismContractError, type PrismSupplierApplicationStatusResult } from "@prism/types";
import { PrismApiError as ApiError } from "@prism/api-client";
import {
  isTerminalSupplierApplicationStatus,
  mapSupplierApplicationStatusFailure,
  supplierApplicationStatusFailureMessage,
  supplierApplicationStatusLabel,
} from "./supplier-application-status-rules";

const statuses: PrismSupplierApplicationStatusResult["status"][] = [
  "pending",
  "under_review",
  "proposal_requested",
  "meeting_scheduled",
  "approved",
  "declined",
];

describe("supplier application status rules", () => {
  it("keeps applicant-facing labels limited to the five accepted statuses", () => {
    expect(statuses.map(supplierApplicationStatusLabel)).toEqual([
      "Under Review",
      "Under Review",
      "Proposal Requested",
      "Meeting Scheduled",
      "Approved",
      "Declined",
    ]);
  });

  it("polls only non-terminal statuses", () => {
    expect(isTerminalSupplierApplicationStatus("pending")).toBe(false);
    expect(isTerminalSupplierApplicationStatus("meeting_scheduled")).toBe(false);
    expect(isTerminalSupplierApplicationStatus("approved")).toBe(true);
    expect(isTerminalSupplierApplicationStatus("declined")).toBe(true);
  });

  it("distinguishes validation, not-found, and unavailable failures", () => {
    expect(mapSupplierApplicationStatusFailure(new PrismContractError("invalid input", []) )).toBe("invalid_input");
    expect(mapSupplierApplicationStatusFailure(new ApiError(404, { message: "missing" }))).toBe("not_found");
    expect(mapSupplierApplicationStatusFailure(new ApiError(400, { message: "invalid" }))).toBe("unavailable");
    expect(supplierApplicationStatusFailureMessage("not_found")).toContain("reference and email");
  });
});
