import type { OpsBillingSource, OpsBillingStatement, OpsPaymentMilestone } from '@prisma/client';

export type RecordPaymentInput = {
  amountReceived: number;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string;
};

export type BillingLineItemInput = {
  label: string;
  amount: number;
};

export type BillingScheduleInput = {
  label: string;
  percentage: number;
  dueDate?: string;
};

export type BillingMethodInput = {
  label: string;
  details: string;
};

export type CreateBillingSourceInput = {
  sourceType?: string;
  sourceLabel: string;
  sourceDocumentId?: string;
  lineItems: BillingLineItemInput[];
  paymentSchedule?: BillingScheduleInput[];
  paymentMethods?: BillingMethodInput[];
};

export type ApproveBillingSourceInput = {
  approvedBy?: string;
  approvalNotes?: string;
};

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
  generateBillingStatement(eventId: string, sourceId?: string, actor?: BillingActor): Promise<unknown>;
  sendBillingStatement(eventId: string, billingId: string, actor?: BillingActor): Promise<unknown>;
  mapBillingSource(source: OpsBillingSource): unknown;
  mapBillingStatement(statement: OpsBillingStatement): unknown;
  mapPaymentMilestone(payment: OpsPaymentMilestone, history?: unknown[]): unknown;
}
