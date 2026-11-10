import type {
  CreateAdditionalBillingInput,
  CreateBillingDisputeInput,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  ResolveBillingDisputeInput,
  WaiveAdditionalBillingInput,
} from "@prism/types";
import { eventApi } from "@/lib/prism-api";

export const billingAdjustmentRepository = {
  loadBilling: () => eventApi.billing.list(),
  createDispute: (eventId: string, input: CreateBillingDisputeInput) => eventApi.commercial.createBillingDispute(eventId, input),
  resolveDispute: (eventId: string, disputeId: string, input: ResolveBillingDisputeInput) =>
    eventApi.commercial.resolveBillingDispute(eventId, disputeId, input),
  createCorrection: (eventId: string, input: RequestBillingCorrectionInput) => eventApi.commercial.requestBillingCorrection(eventId, input),
  resolveCorrection: (eventId: string, correctionId: string, input: ResolveBillingCorrectionInput) =>
    eventApi.commercial.resolveBillingCorrection(eventId, correctionId, input),
  createAdditionalBilling: (eventId: string, input: CreateAdditionalBillingInput) => eventApi.commercial.createAdditionalBilling(eventId, input),
  waiveAdditionalBilling: (eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput) =>
    eventApi.commercial.waiveAdditionalBilling(eventId, additionalBillingId, input),
};

export type BillingAdjustmentWriter = typeof billingAdjustmentRepository;
