import { describe, expect, it } from "vitest";
import type { PrismBillingStatement } from "@prism/types";
import { fillBillingTemplate } from "./billing-template-fill";

const statement = {
  id: "bs_1", eventId: "evt_1", number: "BS-2027-0007", clientName: "Ana Cruz", clientContact: "ana@acme.test", eventName: "Acme Gala",
  eventDate: "2027-02-14T00:00:00.000Z", totalAmount: 450000,
  lineItems: [{ label: "Venue styling", amount: 300000 }, { label: "AV", amount: 150000 }],
  paymentSchedule: [{ label: "Down payment", percentage: 50, amount: 225000, dueDate: "2027-01-10" }],
  paymentMethods: [{ label: "Bank Transfer", details: "BPI 1234" }], pdfUrl: "", status: "issued",
} as unknown as PrismBillingStatement;

describe("FR-67 billing template prefill", () => {
  it("fills known fields from the issued statement and reports placeholders it does not know", () => {
    const result = fillBillingTemplate("No. {{statementNumber}} for {{ clientName }}\n{{lineItems}}\nTotal {{totalAmount}}\n{{purchaseOrder}}", statement);
    expect(result.text).toBe("No. BS-2027-0007 for Ana Cruz\nVenue styling: PHP 300,000\nAV: PHP 150,000\nTotal PHP 450,000\n{{purchaseOrder}}");
    expect(result.unknown).toEqual(["purchaseOrder"]);
  });
});
