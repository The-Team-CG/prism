import type { OpsBillingSource, OpsBillingStatement, OpsPaymentMilestone, OpsPaymentRecord } from '@prisma/client';
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
  name: string;
  role?: string;
  email?: string;
  correlationId?: string;
};

export interface FinanceCommands {
  runPaymentRiskSweep(): Promise<void>;
  markPayment(eventId: string, milestoneId: string, status: string, actor?: BillingActor): Promise<unknown>;
  recordPayment(eventId: string, milestoneId: string, input: RecordPaymentInput, actor?: BillingActor): Promise<unknown>;
  createBillingSource(eventId: string, input: CreateBillingSourceInput, actor: BillingActor): Promise<unknown>;
  approveBillingSource(eventId: string, sourceId: string, input: ApproveBillingSourceInput, actor: BillingActor): Promise<unknown>;
  generateBillingStatement(eventId: string, sourceId?: string, actor?: BillingActor, idempotencyKey?: string): Promise<unknown>;
  sendBillingStatement(eventId: string, billingId: string, actor?: BillingActor): Promise<unknown>;
  requestBillingCorrection(eventId: string, input: RequestBillingCorrectionInput, actor: BillingActor): Promise<unknown>;
  resolveBillingCorrection(eventId: string, correctionId: string, input: ResolveBillingCorrectionInput, actor: BillingActor): Promise<unknown>;
  createBillingDispute(eventId: string, input: CreateBillingDisputeInput, actor: BillingActor): Promise<unknown>;
  resolveBillingDispute(eventId: string, disputeId: string, input: ResolveBillingDisputeInput, actor: BillingActor): Promise<unknown>;
  createAdditionalBilling(eventId: string, input: CreateAdditionalBillingInput, actor: BillingActor): Promise<unknown>;
  waiveAdditionalBilling(eventId: string, additionalBillingId: string, input: WaiveAdditionalBillingInput, actor: BillingActor): Promise<unknown>;
  mapBillingSource(source: OpsBillingSource): unknown;
  mapBillingStatement(statement: OpsBillingStatement): unknown;
  mapPaymentMilestone(payment: OpsPaymentMilestone, history?: unknown[]): unknown;
  mapPaymentRecord(record: OpsPaymentRecord): unknown;
}
