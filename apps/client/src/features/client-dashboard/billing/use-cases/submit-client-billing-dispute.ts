import { createBillingDisputeSchema, parseContract, type CreateBillingDisputeInput, type PrismClientBillingDispute } from "@prism/types";
import { clientBillingDisputeRepository } from "../data/client-billing-dispute-repository";

export async function submitClientBillingDispute(eventId: string, draft: Omit<CreateBillingDisputeInput, "idempotencyKey">): Promise<PrismClientBillingDispute> {
  const input = parseContract(createBillingDisputeSchema, { ...draft, idempotencyKey: crypto.randomUUID() }, "Billing dispute");
  return clientBillingDisputeRepository.create(eventId, input);
}
