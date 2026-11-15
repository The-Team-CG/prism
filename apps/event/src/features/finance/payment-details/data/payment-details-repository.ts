import { defineResource } from "@prism/portal-query";
import type { SavePaymentDetailsInput } from "@prism/types";
import { eventApi } from "@/lib/prism-api";

/** PMCM's one set of payment details. */
export const financePaymentDetails = defineResource({
  name: "finance.payment-details",
  staleMs: 15_000,
  fetch: (_key: "pmcm", signal) => eventApi.commercial.paymentDetails({ signal }),
});

export const paymentDetailsCommands = {
  read: () => eventApi.commercial.paymentDetails(),
  save: (input: SavePaymentDetailsInput) => eventApi.commercial.savePaymentDetails(input),
  uploadQr: (file: File) => eventApi.commercial.uploadPaymentQr(file),
  qrImage: (imageId: string) => eventApi.commercial.paymentQrImage(imageId),
};
