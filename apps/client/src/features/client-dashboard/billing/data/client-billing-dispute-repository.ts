import type { CreateBillingDisputeInput, PrismClientBillingDispute } from "@prism/types";
import { clientApiRequest } from "@/lib/prism-api";

export const clientBillingDisputeRepository = {
  create(eventId: string, input: CreateBillingDisputeInput) {
    return clientApiRequest<PrismClientBillingDispute>(`/api/events/${eventId}/billing-disputes`, {
      method: "POST",
      body: input,
    });
  },
};
