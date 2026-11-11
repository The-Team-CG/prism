/**
 * Rules for the receipt ledger. A receipt is money that arrived outside P.R.I.S.M. It reaches milestones as
 * payment records (positive amounts), a reversal is a record with a negative amount that names the one it undoes,
 * and a refund pays unapplied money back. Everything a receipt shows follows from those three lists.
 */

export type ReceiptStatus = 'recorded' | 'verified' | 'rejected' | 'reversed';

/** Statuses of a receipt whose money still counts: it can be applied, refunded, verified or reversed. */
export const LIVE_RECEIPT_STATUSES: readonly ReceiptStatus[] = ['recorded', 'verified'];

export type RuleResult = { ok: true } | { ok: false; kind: 'conflict' | 'invalid'; message: string };
const ok: RuleResult = { ok: true };
const conflict = (message: string): RuleResult => ({ ok: false, kind: 'conflict', message });
const invalid = (message: string): RuleResult => ({ ok: false, kind: 'invalid', message });

const isLive = (status: ReceiptStatus) => LIVE_RECEIPT_STATUSES.includes(status);
const pesos = (amount: number) => `PHP ${amount.toLocaleString('en-PH')}`;

/** A bank reference with case and punctuation removed, so "BDO-0012 34" and "bdo001234" are the same transfer. */
export function normalizeReference(reference: string | null | undefined): string | null {
  const key = (reference ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return key === '' ? null : key;
}

export interface LedgerRecord {
  id: string;
  amountReceived: number;
  reversesRecordId: string | null;
}

export interface ReceiptBalance {
  applied: number;
  refunded: number;
  unapplied: number;
}

/** What is applied (reversals net out), what was paid back, and what is left. */
export function receiptBalance(
  amount: number,
  records: Array<Pick<LedgerRecord, 'amountReceived'>>,
  refunds: Array<{ amount: number }>,
): ReceiptBalance {
  const applied = records.reduce((sum, record) => sum + record.amountReceived, 0);
  const refunded = refunds.reduce((sum, refund) => sum + refund.amount, 0);
  return { applied, refunded, unapplied: amount - applied - refunded };
}

/** For each positive record: whether a reversal undid it, and which. A reversal is never itself listed as reversible. */
export function allocationStates(records: LedgerRecord[]): Map<string, { reversed: boolean; reversalId: string | null }> {
  const reversalOf = new Map(
    records.filter((record) => record.reversesRecordId).map((record) => [record.reversesRecordId as string, record.id]),
  );
  return new Map(
    records
      .filter((record) => !record.reversesRecordId)
      .map((record) => [record.id, { reversed: reversalOf.has(record.id), reversalId: reversalOf.get(record.id) ?? null }]),
  );
}

export function checkAllocation(input: {
  status: ReceiptStatus;
  unapplied: number;
  milestoneRemaining: number;
  amount: number;
}): RuleResult {
  if (!isLive(input.status)) return conflict(`A ${input.status} receipt cannot be applied to a milestone`);
  if (input.amount < 1) return invalid('Amount to apply must be greater than zero');
  if (input.amount > input.unapplied) return conflict(`Only ${pesos(Math.max(0, input.unapplied))} of this receipt is unapplied`);
  if (input.amount > input.milestoneRemaining) {
    return conflict(`The milestone has only ${pesos(Math.max(0, input.milestoneRemaining))} left to pay`);
  }
  return ok;
}

export function checkRefund(input: { status: ReceiptStatus; unapplied: number; amount: number }): RuleResult {
  if (!isLive(input.status)) return conflict(`A ${input.status} receipt cannot be refunded`);
  if (input.amount < 1) return invalid('Refund amount must be greater than zero');
  if (input.amount > input.unapplied) {
    return conflict(`Only ${pesos(Math.max(0, input.unapplied))} is unapplied. Reverse its allocation first to refund more`);
  }
  return ok;
}

/** Proof is attached to money held for an event: the file lives with that event's storage, and only a live receipt needs one. */
export function checkAttachEvidence(input: { status: ReceiptStatus; hasEvent: boolean }): RuleResult {
  if (!isLive(input.status)) return conflict(`A ${input.status} receipt cannot take evidence`);
  return input.hasEvent ? ok : conflict('Say which event this money was meant for before attaching evidence');
}

/** Money held with no event can be assigned one once; moving it from one event to another is a reversal and a new receipt. */
export function checkEarmark(input: { status: ReceiptStatus; hasEvent: boolean }): RuleResult {
  if (!isLive(input.status)) return conflict(`A ${input.status} receipt cannot be assigned an event`);
  return input.hasEvent ? conflict('This receipt is already held for an event') : ok;
}

export function checkVerify(status: ReceiptStatus): RuleResult {
  if (status === 'verified') return conflict('This receipt is already verified');
  return status === 'recorded' ? ok : conflict(`A ${status} receipt cannot be verified`);
}

/** Rejecting says the money never arrived. Anything already applied must be reversed first, so nothing stays counted. */
export function checkReject(input: { status: ReceiptStatus; activeAllocations: number }): RuleResult {
  if (input.status !== 'recorded') {
    return conflict(input.status === 'verified' ? 'A verified receipt cannot be rejected; reverse it instead' : `A ${input.status} receipt cannot be rejected`);
  }
  return input.activeAllocations > 0 ? conflict('Reverse its allocations before rejecting it') : ok;
}

/** Reversing a receipt says the money never arrived (a bounced cheque). Money already paid back cannot be un-arrived. */
export function checkReverseReceipt(input: { status: ReceiptStatus; refunded: number }): RuleResult {
  if (!isLive(input.status)) return conflict(`A ${input.status} receipt cannot be reversed`);
  return input.refunded > 0 ? conflict('This receipt has refunds. Part of it was already paid back, so it cannot be reversed') : ok;
}

export function checkReverseAllocation(
  record: Pick<LedgerRecord, 'amountReceived' | 'reversesRecordId'>,
  alreadyReversed: boolean,
): RuleResult {
  if (record.reversesRecordId || record.amountReceived <= 0) return conflict('Only a payment can be reversed, not a reversal');
  return alreadyReversed ? conflict('This payment was already reversed') : ok;
}

export interface DuplicateProbe {
  amount: number;
  method: string;
  receivedDate: string;
  payerName: string;
}

/**
 * A live receipt that looks like the same payment recorded twice: same amount, method, day and payer. Only used when
 * there is no bank reference to compare, since an exact reference is already refused as a duplicate outright.
 */
export function findPossibleDuplicate<T extends DuplicateProbe & { id: string }>(candidates: T[], probe: DuplicateProbe): T | undefined {
  const payer = probe.payerName.trim().toLowerCase();
  if (!payer) return undefined;
  return candidates.find(
    (candidate) =>
      candidate.amount === probe.amount &&
      candidate.method === probe.method &&
      candidate.receivedDate === probe.receivedDate &&
      candidate.payerName.trim().toLowerCase() === payer,
  );
}
