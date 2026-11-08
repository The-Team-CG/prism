import { describe, expect, it } from "vitest";
import type { PrismAddendum } from "@prism/types";
import { pendingBillingAddendumLine, pendingBillingAddenda } from "./pending-addenda";

function addendum(overrides: Partial<PrismAddendum>): PrismAddendum {
  return {
    id: "addendum_1", eventId: "evt_1", versionNumber: 2, title: "Lighting", summary: "", status: "pending", documentId: "doc_1", documentState: "available",
    signatureMethod: "scanned_document", comparison: { contract: [], quotes: [] }, financialDelta: 15000, issuedAt: "2026-10-19T09:00:00.000Z",
    effectiveAt: null, withdrawnAt: null, withdrawalReason: null,
    plannedImpacts: { financialDelta: 15000, billing: { billingSourceId: "billing_1", baselineTotalAmount: 100000, baselineLineItems: [] }, quotes: [] },
    conforme: null, ...overrides,
  };
}

describe("finance pending addenda", () => {
  it("lists only pending addenda that will change billing or selected quotes", () => {
    const pendingBilling = addendum({});
    const pendingQuoteOnly = addendum({
      id: "addendum_2", financialDelta: 0,
      plannedImpacts: { financialDelta: 0, billing: null, quotes: [{ quoteId: "quote_1", baselineAmount: 20000, targetAmount: 25000 }] },
    });
    const pendingWithNoEffect = addendum({ id: "addendum_3", financialDelta: 0, plannedImpacts: { financialDelta: 0, billing: null, quotes: [] } });
    const effective = addendum({ id: "addendum_4", status: "effective", plannedImpacts: null });
    const withdrawn = addendum({ id: "addendum_5", status: "withdrawn", plannedImpacts: null, withdrawalReason: "Venue cannot take the rig" });

    expect(pendingBillingAddenda([pendingBilling, pendingQuoteOnly, pendingWithNoEffect, effective, withdrawn]).map((item) => item.id))
      .toEqual(["addendum_1", "addendum_2"]);
  });

  it("states the billing change and says it applies only when PMCM countersigns", () => {
    expect(pendingBillingAddendumLine(addendum({}))).toBe("Addendum v2: billing +15,000. Applied when PMCM countersigns.");
    expect(pendingBillingAddendumLine(addendum({
      id: "addendum_2", financialDelta: 0,
      plannedImpacts: { financialDelta: 0, billing: null, quotes: [{ quoteId: "quote_1", baselineAmount: 20000, targetAmount: 25000 }] },
    }))).toBe("Addendum v2: no billing change, 1 selected quote. Applied when PMCM countersigns.");
  });
});
