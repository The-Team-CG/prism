"use client";

import { PaymentDetailsView } from "@/features/finance/payment-details";

/** PMCM's payment details are company-wide, not one event's, so they sit beside Finance like Receipts. */
export function EventDashboardFinancePaymentDetailsSectionView() {
  return <PaymentDetailsView />;
}
