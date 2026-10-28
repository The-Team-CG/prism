import type { OpsAdditionalBilling, OpsBillingCorrection, OpsBillingDispute, OpsBillingStatement, OpsBillingSource, OpsPaymentMilestone, OpsPaymentRecord } from '@prisma/client';

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function timestamp(value: Date) {
  return value.toISOString();
}

export function mapBillingCorrection(correction: OpsBillingCorrection) {
  return { id: correction.id, eventId: correction.eventId, statementId: correction.statementId, replacementStatementId: correction.replacementStatementId ?? null, reason: correction.reason, correctedTotalAmount: correction.correctedTotalAmount ?? null, status: correction.status, requestedBy: correction.requestedBy, requestedById: correction.requestedById ?? null, resolvedBy: correction.resolvedBy ?? null, resolutionNotes: correction.resolutionNotes ?? null, createdAt: timestamp(correction.createdAt), resolvedAt: correction.resolvedAt ? timestamp(correction.resolvedAt) : null };
}

export function mapBillingDispute(dispute: OpsBillingDispute) {
  return { id: dispute.id, eventId: dispute.eventId, statementId: dispute.statementId, milestoneId: dispute.milestoneId ?? null, amount: dispute.amount, reason: dispute.reason, status: dispute.status, raisedBy: dispute.raisedBy, resolvedBy: dispute.resolvedBy ?? null, resolutionNotes: dispute.resolutionNotes ?? null, createdAt: timestamp(dispute.createdAt), resolvedAt: dispute.resolvedAt ? timestamp(dispute.resolvedAt) : null };
}

/** Client-safe dispute projection: status and amount only, no PMCM reasons, resolver notes, or actor names. */
export function mapClientBillingDispute(dispute: OpsBillingDispute) {
  return { id: dispute.id, eventId: dispute.eventId, statementId: dispute.statementId, milestoneId: dispute.milestoneId ?? null, amount: dispute.amount, status: dispute.status, createdAt: timestamp(dispute.createdAt), resolvedAt: dispute.resolvedAt ? timestamp(dispute.resolvedAt) : null };
}

export function mapAdditionalBilling(billing: OpsAdditionalBilling) {
  return { id: billing.id, eventId: billing.eventId, urgentIssueId: billing.urgentIssueId, billingSourceId: billing.billingSourceId ?? null, description: billing.description, amount: billing.amount, status: billing.status, createdBy: billing.createdBy, waiverReason: billing.waiverReason ?? null, waivedBy: billing.waivedBy ?? null, createdAt: timestamp(billing.createdAt), waivedAt: billing.waivedAt ? timestamp(billing.waivedAt) : null };
}

export function mapBillingSource(source: OpsBillingSource) {
  return {
    id: source.id,
    eventId: source.eventId,
    sourceType: source.sourceType,
    sourceLabel: source.sourceLabel,
    sourceDocumentId: source.sourceDocumentId ?? null,
    lineItems: Array.isArray(source.lineItems) ? source.lineItems : [],
    paymentSchedule: Array.isArray(source.paymentSchedule) ? source.paymentSchedule : [],
    paymentMethods: Array.isArray(source.paymentMethods) ? source.paymentMethods : [],
    totalAmount: source.totalAmount,
    status: source.status,
    approvedAt: source.approvedAt ? timestamp(source.approvedAt) : null,
    approvedBy: source.approvedBy ?? null,
    approvalNotes: source.approvalNotes,
    paymentTermsPolicyState: source.paymentTermsPolicyState,
    paymentTermsOverrideReason: source.paymentTermsOverrideReason ?? null,
    paymentTermsApprovedBy: source.paymentTermsApprovedBy ?? null,
    createdAt: timestamp(source.createdAt),
    updatedAt: timestamp(source.updatedAt),
  };
}

export function mapClientBillingStatement(statement: OpsBillingStatement) {
  const { storageKey: _key, ...visible } = mapBillingStatement(statement);
  return visible;
}

export function mapBillingStatement(statement: OpsBillingStatement) {
  return {
    id: statement.id,
    eventId: statement.eventId,
    sourceId: statement.sourceId ?? null,
    supersedesStatementId: statement.supersedesStatementId ?? null,
    number: statement.number,
    clientName: statement.clientName,
    clientContact: statement.clientContact,
    eventName: statement.eventName,
    eventDate: statement.eventDate ? isoDate(statement.eventDate) : null,
    lineItems: Array.isArray(statement.lineItems) ? statement.lineItems : [],
    paymentSchedule: Array.isArray(statement.paymentSchedule) ? statement.paymentSchedule : [],
    paymentMethods: Array.isArray(statement.paymentMethods) ? statement.paymentMethods : [],
    totalAmount: statement.totalAmount,
    documentId: statement.documentId ?? null,
    pdfUrl: statement.pdfUrl,
    storageKey: statement.storageKey,
    storageObjectId: statement.storageObjectId ?? null,
    storageState: statement.storageState,
    status: statement.status,
    sentAt: statement.sentAt ? timestamp(statement.sentAt) : null,
    generatedAt: timestamp(statement.generatedAt),
  };
}

export function mapPaymentMilestone(payment: OpsPaymentMilestone, history: OpsPaymentRecord[] = []) {
  const amountPaid = payment.amountPaid ?? history.reduce((sum, record) => sum + record.amountReceived, 0);
  const remainingBalance = payment.remainingBalance ?? Math.max(0, payment.amount - amountPaid);
  return {
    id: payment.id,
    eventId: payment.eventId,
    label: payment.label,
    percentage: payment.percentage ?? 50,
    amount: payment.amount,
    amountPaid,
    remainingBalance,
    dueDate: isoDate(payment.dueDate),
    overdue: remainingBalance > 0 && payment.dueDate.getTime() < Date.now(),
    supersededAt: payment.supersededAt ? timestamp(payment.supersededAt) : null,
    status: payment.status,
    history: history.map((record) => mapPaymentRecord(record)),
  };
}

export function mapPaymentRecord(record: OpsPaymentRecord) {
  return {
    id: record.id,
    eventId: record.eventId,
    milestoneId: record.milestoneId,
    amountReceived: record.amountReceived,
    paymentDate: isoDate(record.paymentDate),
    paymentMethod: record.paymentMethod,
    referenceNumber: record.referenceNumber,
    recordedAt: timestamp(record.recordedAt),
  };
}
