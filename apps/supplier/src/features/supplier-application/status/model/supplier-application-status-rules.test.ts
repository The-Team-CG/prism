import { describe, expect, it } from "vitest";
import type { PrismSupplierApplicationStatusResult } from "@prism/types";
import {
  isTerminalSupplierApplicationStatus,
  supplierApplicationStatusRefreshDelay,
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

  it("provides safe messages for domain failure states", () => {
    expect(supplierApplicationStatusFailureMessage("not_found")).toContain("reference and email");
    expect(supplierApplicationStatusFailureMessage("unavailable")).toContain("temporarily unavailable");
  });

  it("backs off automatic refresh after repeated transient failures", () => {
    expect(supplierApplicationStatusRefreshDelay(0)).toBe(30_000);
    expect(supplierApplicationStatusRefreshDelay(1)).toBe(60_000);
    expect(supplierApplicationStatusRefreshDelay(2)).toBe(120_000);
    expect(supplierApplicationStatusRefreshDelay(20)).toBe(300_000);
  });
});
