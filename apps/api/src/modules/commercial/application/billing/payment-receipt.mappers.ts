import type { OpsPaymentRecord, OpsPaymentReceipt, OpsPaymentRefund } from '@prisma/client';
import type { PrismPaymentReceipt, PrismPaymentReceiptEvidence, PrismPaymentReceiptStatus, PrismPaymentRefund } from '@prism/types';
import { allocationStates, receiptBalance } from '../../domain/payment-receipt.policy';

export type ReceiptWithLedger = OpsPaymentReceipt & { records: OpsPaymentRecord[]; refunds: OpsPaymentRefund[] };

const STATUSES: readonly PrismPaymentReceiptStatus[] = ['recorded', 'verified', 'rejected', 'reversed'];
const LEGACY_PREFIX = 'prcp_legacy_';

export function receiptStatus(value: string): PrismPaymentReceiptStatus {
  return STATUSES.find((status) => status === value) ?? 'recorded';
}

export function mapPaymentRefund(refund: OpsPaymentRefund): PrismPaymentRefund {
  return {
    id: refund.id,
    amount: refund.amount,
    refundedDate: refund.refundedDate.toISOString().slice(0, 10),
    method: refund.method,
    referenceNumber: refund.referenceNumber,
    reason: refund.reason,
    recordedBy: refund.recordedBy,
    recordedAt: refund.createdAt.toISOString(),
  };
}

/** `labels` maps milestone ids to their label so each allocation reads "Deposit", not an id. */
export function mapPaymentReceipt(receipt: ReceiptWithLedger, labels: Map<string, string>, evidence: Map<string, PrismPaymentReceiptEvidence> = new Map()): PrismPaymentReceipt {
  const balance = receiptBalance(receipt.amount, receipt.records, receipt.refunds);
  const status = receiptStatus(receipt.status);
  const states = allocationStates(receipt.records);
  const recordById = new Map(receipt.records.map((record) => [record.id, record]));
  const allocations = receipt.records
    .filter((record) => !record.reversesRecordId)
    .map((record) => {
      const state = states.get(record.id);
      const reversal = state?.reversalId ? recordById.get(state.reversalId) : undefined;
      return {
        id: record.id,
        eventId: record.eventId,
        milestoneId: record.milestoneId,
        milestoneLabel: labels.get(record.milestoneId) ?? null,
        amount: record.amountReceived,
        reversed: state?.reversed ?? false,
        reversalId: state?.reversalId ?? null,
        reversalReason: reversal?.reversalReason ?? null,
        recordedAt: record.recordedAt.toISOString(),
      };
    });
  return {
    id: receipt.id,
    amount: receipt.amount,
    receivedDate: receipt.receivedDate.toISOString().slice(0, 10),
    method: receipt.method,
    referenceNumber: receipt.referenceNumber,
    payerName: receipt.payerName,
    eventId: receipt.eventId,
    notes: receipt.notes,
    status,
    source: receipt.source === 'client' ? 'client' : 'pmcm',
    intendedMilestoneId: receipt.intendedMilestoneId,
    intendedMilestoneLabel: receipt.intendedMilestoneId ? labels.get(receipt.intendedMilestoneId) ?? null : null,
    legacy: receipt.id.startsWith(LEGACY_PREFIX),
    evidenceObjectId: receipt.evidenceObjectId,
    evidence: receipt.evidenceObjectId ? evidence.get(receipt.evidenceObjectId) ?? null : null,
    verifiedAt: receipt.verifiedAt?.toISOString() ?? null,
    verifiedBy: receipt.verifiedBy,
    verificationNotes: receipt.verificationNotes,
    rejectionReason: receipt.rejectionReason,
    reversalReason: receipt.reversalReason,
    possibleDuplicateOfId: receipt.possibleDuplicateOfId,
    applied: balance.applied,
    refunded: balance.refunded,
    // A rejected or reversed receipt says the money never arrived, so none of it is left to apply.
    unapplied: status === 'rejected' || status === 'reversed' ? 0 : balance.unapplied,
    allocations,
    refunds: receipt.refunds.map(mapPaymentRefund),
    recordedBy: receipt.recordedBy,
    recordedAt: receipt.createdAt.toISOString(),
  };
}
