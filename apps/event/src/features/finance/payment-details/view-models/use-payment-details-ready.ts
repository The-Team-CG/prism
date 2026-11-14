"use client";

import { useResource } from "@prism/portal-query";
import { financePaymentDetails } from "../data/payment-details-repository";

/** Whether at least one payment method is turned on, so a statement can be issued; null until that is known. */
export function usePaymentDetailsReady(): boolean | null {
  const details = useResource(financePaymentDetails, "pmcm");
  return details.data ? details.data.methods.some((method) => method.enabled) : null;
}
