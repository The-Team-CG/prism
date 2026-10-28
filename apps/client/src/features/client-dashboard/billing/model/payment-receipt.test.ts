import { describe, expect, it } from "vitest";
import { createPaymentReceiptPdf, paymentReceiptFileName } from "./payment-receipt";

describe("payment receipt", () => {
  it("creates a downloadable PDF from the recorded payment details", async () => {
    const pdf = createPaymentReceiptPdf({
      eventName: "Winter Gala",
      milestoneLabel: "Downpayment",
      payment: {
        id: "payrec_123",
        eventId: "evt_1",
        milestoneId: "pay_1",
        amountReceived: 25000,
        paymentDate: "2026-10-20",
        paymentMethod: "Bank transfer",
        referenceNumber: "BNK-42",
        recordedAt: "2026-10-20T10:30:00.000Z",
      },
    });

    expect(pdf.type).toBe("application/pdf");
    expect(await pdf.text()).toContain("%PDF-1.4");
    expect(await pdf.text()).toContain("Record ID: payrec_123");
    expect(await pdf.text()).toContain("BNK-42");
    expect(paymentReceiptFileName("payrec_123")).toBe("payment-receipt-payrec_123.pdf");
  });
});
