import type { PaymentMethod } from "@prism/types";

export type PayToField = { label: string; value: string };
export type PayToPanel = { id: string; label: string; fields: PayToField[]; instructions: string; qrImageId: string | null };

/**
 * What the client reads for each account PMCM has turned on: each value on its own line so each can be copied, in the
 * order PMCM set. A cheque has a payee only; a bank account or e-wallet has a name and a number, and may have a QR.
 */
export function payToPanels(payTo: PaymentMethod[]): PayToPanel[] {
  return payTo.map((method) => ({
    id: method.id,
    label: method.label,
    fields: method.kind === "cheque"
      ? [{ label: "Payable to", value: method.accountName }]
      : [{ label: "Account name", value: method.accountName }, { label: "Account number", value: method.accountNumber }],
    instructions: method.instructions,
    qrImageId: method.kind === "cheque" ? null : method.qrImageId,
  }));
}

/** A file name for a saved QR, such as `payment-qr-gcash.png`, safe on every device. */
export function qrFileName(label: string, contentType: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "account";
  return `payment-qr-${slug}.${contentType === "image/jpeg" ? "jpg" : "png"}`;
}
