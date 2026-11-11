import { describe, expect, it } from "vitest";
import type { PrismEventFinancialSummary } from "@prism/types";
import { categoriesOverEstimate, marginBasisLabel, marginTone, overdueDetail, receivedTrustDetail, signedAmount } from "./financial-summary-rules";

const format = (amount: number) => `PHP ${amount.toLocaleString("en-PH")}`;
const collections = (overrides: Partial<PrismEventFinancialSummary["collections"]> = {}): PrismEventFinancialSummary["collections"] => ({
  scheduled: 150000, received: 100000, credit: 0, outstanding: 50000, overdue: 0, verifiedReceived: 100000, unverifiedReceived: 0, unapplied: 0, ...overrides,
});

describe("financial summary rules", () => {
  it("spells out the sign of a margin so a loss is never read as a gain", () => {
    expect(signedAmount(60000, format)).toBe("+PHP 60,000");
    expect(signedAmount(-10000, format)).toBe("−PHP 10,000");
    expect(signedAmount(0, format)).toBe("PHP 0");
    expect(marginTone(60000)).toBe("neutral");
    expect(marginTone(-1)).toBe("urgent");
    expect(marginTone(0)).toBe("neutral");
    expect(marginTone(null)).toBe("neutral");
  });

  it("says which price the margin was measured against, including when there is none", () => {
    expect(marginBasisLabel("statement")).toMatch(/Billing statement/);
    expect(marginBasisLabel("estimate")).toMatch(/no statement yet/);
    expect(marginBasisLabel(null)).toBe("No price yet");
  });

  it("distinguishes money that was received and checked from money that was received and not yet checked", () => {
    expect(receivedTrustDetail(collections({ received: 0, verifiedReceived: 0 }), format)).toBe("Nothing received yet");
    expect(receivedTrustDetail(collections(), format)).toBe("All verified against a statement");
    expect(receivedTrustDetail(collections({ verifiedReceived: 60000, unverifiedReceived: 40000 }), format)).toBe("PHP 40,000 not yet verified");
  });

  it("mentions an overdue balance only when there is one", () => {
    expect(overdueDetail(collections(), format)).toBeUndefined();
    expect(overdueDetail(collections({ overdue: 20000 }), format)).toBe("PHP 20,000 past due");
  });

  it("names the categories whose committed cost already exceeds their estimate", () => {
    const summary = { categories: [
      { category: "Catering", estimatedPrice: 90000, committedCost: 60000, actualCost: 0, expectedMargin: 30000 },
      { category: "Sound", estimatedPrice: 20000, committedCost: 30000, actualCost: 0, expectedMargin: -10000 },
    ] } as PrismEventFinancialSummary;
    expect(categoriesOverEstimate(summary)).toEqual(["Sound"]);
  });
});
