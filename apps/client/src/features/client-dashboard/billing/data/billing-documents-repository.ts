import { clientApi } from "@/lib/prism-api";

/** Billing documents the API renders: the statement of account and a receipt for each payment. */
export const billingDocumentsRepository = {
  statementOfAccount: (eventId: string) => clientApi.events.statementOfAccountPdf(eventId),
  paymentReceipt: (eventId: string, recordId: string) => clientApi.events.paymentReceiptPdf(eventId, recordId),
};
