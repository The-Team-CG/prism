import {
  createAdditionalBillingSchema,
  createBillingDisputeSchema,
  parseContract,
  requestBillingCorrectionSchema,
  resolveBillingDisputeSchema,
  waiveAdditionalBillingSchema,
  type CreateAdditionalBillingInput,
  type CreateBillingDisputeInput,
  type RequestBillingCorrectionInput,
  type ResolveBillingDisputeInput,
  type WaiveAdditionalBillingInput,
} from "@prism/types";
import {
  blankReasonError,
  disputeAmountError,
} from "../model/billing-adjustment-rules";

/** Command port the use cases depend on; the repository satisfies it structurally. */
export type BillingAdjustmentCommands = {
  createDispute: (eventId: string, input: CreateBillingDisputeInput) => Promise<unknown>;
  resolveDispute: (eventId: string, disputeId: string, input: ResolveBillingDisputeInput) => Promise<unknown>;
  createCorrection: (eventId: string, input: RequestBillingCorrectionInput) => Promise<unknown>;
  createAdditionalBilling: (eventId: string, input: CreateAdditionalBillingInput) => Promise<unknown>;
  waiveAdditionalBilling: (eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput) => Promise<unknown>;
};

type IdempotentDraft<T> = Omit<T, "idempotencyKey">;

function failLocalRule(message: string | null): void {
  if (message) throw new Error(message);
}

/** Refuses blocked input before any request is sent; the shared schema then produces the wire body. */
export async function submitBillingDispute(
  writer: Pick<BillingAdjustmentCommands, "createDispute">,
  eventId: string,
  draft: IdempotentDraft<CreateBillingDisputeInput> & { statementTotal?: number },
): Promise<unknown> {
  failLocalRule(blankReasonError(draft.reason, "Dispute reason"));
  failLocalRule(disputeAmountError(draft.amount, draft.statementTotal === undefined ? undefined : { totalAmount: draft.statementTotal }));
  const { statementTotal: _statementTotal, ...body } = draft;
  const input = parseContract(createBillingDisputeSchema, { ...body, idempotencyKey: crypto.randomUUID() }, "Billing dispute");
  return writer.createDispute(eventId, input);
}

export async function submitDisputeResolution(
  writer: Pick<BillingAdjustmentCommands, "resolveDispute">,
  eventId: string,
  disputeId: string,
  draft: ResolveBillingDisputeInput,
): Promise<unknown> {
  const input = parseContract(resolveBillingDisputeSchema, draft, "Dispute resolution");
  return writer.resolveDispute(eventId, disputeId, input);
}

export async function submitBillingCorrection(
  writer: Pick<BillingAdjustmentCommands, "createCorrection">,
  eventId: string,
  draft: IdempotentDraft<RequestBillingCorrectionInput>,
): Promise<unknown> {
  failLocalRule(blankReasonError(draft.reason, "Correction reason"));
  const input = parseContract(requestBillingCorrectionSchema, { ...draft, idempotencyKey: crypto.randomUUID() }, "Billing correction");
  return writer.createCorrection(eventId, input);
}

export async function submitAdditionalBilling(
  writer: Pick<BillingAdjustmentCommands, "createAdditionalBilling">,
  eventId: string,
  draft: IdempotentDraft<CreateAdditionalBillingInput>,
): Promise<unknown> {
  const input = parseContract(createAdditionalBillingSchema, { ...draft, idempotencyKey: crypto.randomUUID() }, "Additional billing");
  return writer.createAdditionalBilling(eventId, input);
}

/** Waiver reason is required: blank input is blocked here, before the waiver request is built. */
export async function submitAdditionalBillingWaiver(
  writer: Pick<BillingAdjustmentCommands, "waiveAdditionalBilling">,
  eventId: string,
  additionalBillingId: string,
  reason: string,
): Promise<unknown> {
  failLocalRule(blankReasonError(reason, "Waiver reason"));
  const input = parseContract(waiveAdditionalBillingSchema, { reason }, "Additional billing waiver");
  return writer.waiveAdditionalBilling(eventId, additionalBillingId, input);
}
