import type {
  CreateAdditionalBillingInput,
  CreateBillingDisputeInput,
  PrismAdditionalBilling,
  PrismBillingCorrection,
  PrismBillingDispute,
  PrismBillingWorkspace,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  ResolveBillingDisputeInput,
  WaiveAdditionalBillingInput,
} from "@prism/types";
import { eventApiRequest } from "@/lib/prism-api";

export const billingAdjustmentRepository = {
  loadBilling: () => eventApiRequest<PrismBillingWorkspace>("/api/billing"),
  createDispute: (eventId: string, input: CreateBillingDisputeInput) =>
    eventApiRequest<PrismBillingDispute>(`/api/events/${eventId}/billing-disputes`, { method: "POST", body: input }),
  resolveDispute: (eventId: string, disputeId: string, input: ResolveBillingDisputeInput) =>
    eventApiRequest<PrismBillingDispute>(`/api/events/${eventId}/billing-disputes/${disputeId}`, { method: "PATCH", body: input }),
  createCorrection: (eventId: string, input: RequestBillingCorrectionInput) =>
    eventApiRequest<PrismBillingCorrection>(`/api/events/${eventId}/billing-corrections`, { method: "POST", body: input }),
  resolveCorrection: (eventId: string, correctionId: string, input: ResolveBillingCorrectionInput) =>
    eventApiRequest<PrismBillingCorrection>(`/api/events/${eventId}/billing-corrections/${correctionId}`, { method: "PATCH", body: input }),
  createAdditionalBilling: (eventId: string, input: CreateAdditionalBillingInput) =>
    eventApiRequest<PrismAdditionalBilling>(`/api/events/${eventId}/additional-billing`, { method: "POST", body: input }),
  waiveAdditionalBilling: (eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput) =>
    eventApiRequest<PrismAdditionalBilling>(`/api/events/${eventId}/additional-billing/${additionalBillingId}/waive`, { method: "PATCH", body: input }),
};

export type BillingAdjustmentWriter = typeof billingAdjustmentRepository;
