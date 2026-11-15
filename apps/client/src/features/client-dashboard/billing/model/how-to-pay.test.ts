import { describe, expect, it } from "vitest";
import type { PaymentMethod } from "@prism/types";
import { payToPanels, qrFileName } from "./how-to-pay";

const bpi: PaymentMethod = { kind: "bank", id: "00000000-0000-4000-8000-000000000001", label: "BPI", accountName: "PMCM Events Inc.", accountNumber: "0123-4567-89", instructions: "Use the statement number", qrImageId: null, enabled: true };
const gcash: PaymentMethod = { kind: "ewallet", id: "00000000-0000-4000-8000-000000000002", label: "GCash", accountName: "PMCM Events", accountNumber: "0917 555 0100", instructions: "", qrImageId: "pqr_a", enabled: true };
const cheque: PaymentMethod = { kind: "cheque", id: "00000000-0000-4000-8000-000000000003", label: "Cheque", accountName: "PMCM Events Management", instructions: "", enabled: true };

describe("how to pay", () => {
  it("gives each account its own copyable values in PMCM's order, a cheque only its payee and never a QR", () => {
    expect(payToPanels([gcash, bpi, cheque])).toEqual([
      { id: gcash.id, label: "GCash", fields: [{ label: "Account name", value: "PMCM Events" }, { label: "Account number", value: "0917 555 0100" }], instructions: "", qrImageId: "pqr_a" },
      { id: bpi.id, label: "BPI", fields: [{ label: "Account name", value: "PMCM Events Inc." }, { label: "Account number", value: "0123-4567-89" }], instructions: "Use the statement number", qrImageId: null },
      { id: cheque.id, label: "Cheque", fields: [{ label: "Payable to", value: "PMCM Events Management" }], instructions: "", qrImageId: null },
    ]);
    expect(payToPanels([])).toEqual([]);
  });

  it("names a saved QR after its account, safely, with the right extension", () => {
    expect(qrFileName("GCash", "image/png")).toBe("payment-qr-gcash.png");
    expect(qrFileName("BPI Savings (Makati)", "image/jpeg")).toBe("payment-qr-bpi-savings-makati.jpg");
    expect(qrFileName("???", "image/png")).toBe("payment-qr-account.png");
  });
});
