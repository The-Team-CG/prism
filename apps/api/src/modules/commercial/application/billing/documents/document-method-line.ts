import { paymentMethodLine, type PaymentMethod } from '@prism/types';

/** A method as a billing document prints it: its details, and where to find the QR when it has one (a PDF cannot carry the image). */
export function documentMethodLine(method: PaymentMethod): { label: string; details: string } {
  const line = paymentMethodLine(method);
  const hasQr = 'qrImageId' in method && Boolean(method.qrImageId);
  return hasQr ? { label: line.label, details: `${line.details}\nScan the QR under Billing > How to pay in your P.R.I.S.M portal.` } : line;
}
