import type {
  ApproveBillingSourceInput,
  CreateAdditionalBillingInput,
  CreateBillingDisputeInput,
  CreateBillingSourceInput,
  GenerateBillingStatementInput,
  RecordPaymentInput,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  ResolveBillingDisputeInput,
  WaiveAdditionalBillingInput,
} from '@prism/types';
export type {
  ApproveBillingSourceInput,
  CreateAdditionalBillingInput,
  CreateBillingDisputeInput,
  CreateBillingSourceInput,
  GenerateBillingStatementInput,
  RecordPaymentInput,
  RequestBillingCorrectionInput,
  ResolveBillingCorrectionInput,
  ResolveBillingDisputeInput,
  WaiveAdditionalBillingInput,
} from '@prism/types';

export type BillingLineItemInput = CreateBillingSourceInput['lineItems'][number];
export type BillingScheduleInput = NonNullable<CreateBillingSourceInput['paymentSchedule']>[number];
export type BillingMethodInput = NonNullable<CreateBillingSourceInput['paymentMethods']>[number];

export type BillingActor = {
  id: string;
  name: string;
  role: string;
  email?: string;
  correlationId?: string;
};
