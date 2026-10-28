import type { PrismPaymentRecord } from "@prism/types";

function pdfEscape(value: string) {
  return value.normalize("NFKD").replace(/[^\x20-\x7e]/g, "?").replace(/[()\\]/g, "\\$&");
}

export function createPaymentReceiptPdf(input: {
  eventName: string;
  milestoneLabel: string;
  payment: PrismPaymentRecord;
}) {
  const lines = [
    "P.R.I.S.M PAYMENT RECEIPT",
    `Event: ${input.eventName}`,
    `Payment milestone: ${input.milestoneLabel}`,
    `Amount received: PHP ${input.payment.amountReceived.toLocaleString("en-PH")}`,
    `Payment date: ${input.payment.paymentDate}`,
    `Method: ${input.payment.paymentMethod}`,
    `Reference: ${input.payment.referenceNumber || "Not provided"}`,
    `Record ID: ${input.payment.id}`,
    `Recorded at: ${input.payment.recordedAt}`,
    "This receipt confirms the payment record entered in P.R.I.S.M.",
  ];
  const text = lines.map((line, index) => `${index === 0 ? "/F1 16 Tf" : "/F1 11 Tf"} 0 -${index === 0 ? 0 : 28} Td (${pdfEscape(line)}) Tj`).join("\n");
  const body = `BT 72 740 Td\n${text}\nET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(body).byteLength} >>\nstream\n${body}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i += 1) {
    offsets.push(new TextEncoder().encode(pdf).byteLength);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).byteLength;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function paymentReceiptFileName(recordId: string) {
  return `payment-receipt-${recordId}.pdf`;
}
