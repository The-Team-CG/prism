import type { CreateBillingDisputeInput } from "@prism/types";
import { clientApi } from "@/lib/prism-api";

export const clientBillingDisputeRepository = {
  create(eventId: string, input: CreateBillingDisputeInput) {
    return clientApi.commercial.createClientBillingDispute(eventId, input);
  },
};
