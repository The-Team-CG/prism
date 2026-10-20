import { describe, expect, it } from "vitest";
import type { PrismRetentionPolicy, PrismRetentionReviewItem } from "@prism/types";
import { canDismissReviewItem, canEnablePolicy, canExecuteReviewItem, parsePeriodDays } from "./retention-rules";

function reviewItem(status: PrismRetentionReviewItem["status"]): PrismRetentionReviewItem {
  return {
    id: "retention_1",
    category: "inquiry",
    subjectType: "inquiry",
    subjectId: "inq_1",
    eventId: "evt_1",
    subjectEmail: "",
    subjectName: "",
    anchorAt: "2026-01-01T00:00:00.000Z",
    dueSince: "2028-01-01T00:00:00.000Z",
    status,
    decisionReason: "",
    decidedBy: null,
    decidedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
  };
}

describe("privacy retention review rules", () => {
  it("lets operators execute only pending items and dismiss pending or held items", () => {
    expect(canExecuteReviewItem(reviewItem("pending"))).toBe(true);
    expect(canExecuteReviewItem(reviewItem("held"))).toBe(false);
    expect(canDismissReviewItem(reviewItem("held"))).toBe(true);
    expect(canDismissReviewItem(reviewItem("executed"))).toBe(false);
    expect(canDismissReviewItem(reviewItem("dismissed"))).toBe(false);
  });

  it("accepts whole periods within the API bounds and refuses reference-only categories", () => {
    expect(parsePeriodDays(" 730 ")).toBe(730);
    expect(parsePeriodDays("29")).toBeNull();
    expect(parsePeriodDays("3651")).toBeNull();
    expect(parsePeriodDays("2.5")).toBeNull();
    expect(canEnablePolicy({ sweepable: false } as PrismRetentionPolicy)).toBe(false);
    expect(canEnablePolicy({ sweepable: true } as PrismRetentionPolicy)).toBe(true);
  });
});
