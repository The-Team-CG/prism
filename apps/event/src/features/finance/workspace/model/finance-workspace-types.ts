/** Domain markers for finance/workspace feature slice (presentation-first migration). */
export const FINANCE_WORKSPACE_FEATURE = 'finance/workspace' as const;

export type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: "Bank Transfer" | "GCash" | "Cheque";
  referenceNumber?: string;
};
