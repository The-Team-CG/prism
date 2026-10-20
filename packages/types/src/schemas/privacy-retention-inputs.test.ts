import { describe, expect, it } from "vitest";
import {
  dismissPrivacyRetentionReviewItemSchema,
  listPrivacyRetentionReviewItemsQuerySchema,
  updatePrivacyRetentionPolicySchema,
} from "./privacy-retention-inputs.js";

describe("privacy retention contracts", () => {
  it("requires a reason and a revision for every policy edit, and at least one changed setting", () => {
    expect(updatePrivacyRetentionPolicySchema.safeParse({ enabled: true, expectedRevision: 1, reason: "Board approved" }).success).toBe(true);
    expect(updatePrivacyRetentionPolicySchema.safeParse({ enabled: true, expectedRevision: 1, reason: "   " }).success).toBe(false);
    expect(updatePrivacyRetentionPolicySchema.safeParse({ enabled: true, reason: "No revision" }).success).toBe(false);
    expect(updatePrivacyRetentionPolicySchema.safeParse({ expectedRevision: 1, reason: "No change" }).success).toBe(false);
  });

  it("keeps retention periods between 30 and 3650 whole days", () => {
    const edit = (periodDays: number) => updatePrivacyRetentionPolicySchema.safeParse({ periodDays, expectedRevision: 1, reason: "Period" });
    expect(edit(730).success).toBe(true);
    expect(edit(29).success).toBe(false);
    expect(edit(3651).success).toBe(false);
    expect(edit(365.5).success).toBe(false);
  });

  it("requires a dismissal reason and rejects unknown review statuses", () => {
    expect(dismissPrivacyRetentionReviewItemSchema.safeParse({ reason: "Client asked to keep the record" }).success).toBe(true);
    expect(dismissPrivacyRetentionReviewItemSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(listPrivacyRetentionReviewItemsQuerySchema.safeParse({ status: "held" }).success).toBe(true);
    expect(listPrivacyRetentionReviewItemsQuerySchema.safeParse({ status: "deleted" }).success).toBe(false);
  });
});
