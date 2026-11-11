import { describe, expect, it } from 'vitest';
import {
  allocationStates,
  checkAllocation,
  checkAttachEvidence,
  checkEarmark,
  checkRefund,
  checkReject,
  checkReverseAllocation,
  checkReverseReceipt,
  checkVerify,
  findPossibleDuplicate,
  normalizeReference,
  receiptBalance,
} from './payment-receipt.policy';

const fails = (result: { ok: boolean }) => result.ok === false;

describe('payment receipt ledger rules', () => {
  it('treats references that differ only in case or punctuation as one transfer, and an empty one as none', () => {
    expect(normalizeReference('BDO-0012 34')).toBe('bdo001234');
    expect(normalizeReference('  bdo001234 ')).toBe('bdo001234');
    expect(normalizeReference('---')).toBeNull();
    expect(normalizeReference(undefined)).toBeNull();
  });

  it('computes what is applied, refunded and left, with reversals netting out', () => {
    // 100,000 arrived; 60,000 applied, then 20,000 of that reversed, and 10,000 paid back.
    const records = [{ amountReceived: 60000 }, { amountReceived: -20000 }];
    expect(receiptBalance(100000, records, [{ amount: 10000 }])).toEqual({ applied: 40000, refunded: 10000, unapplied: 50000 });
    expect(receiptBalance(100000, [], [])).toEqual({ applied: 0, refunded: 0, unapplied: 100000 });
  });

  it('marks a payment reversed only when a reversal names it, and never lists a reversal as reversible', () => {
    const states = allocationStates([
      { id: 'a', amountReceived: 5000, reversesRecordId: null },
      { id: 'b', amountReceived: 3000, reversesRecordId: null },
      { id: 'rev_a', amountReceived: -5000, reversesRecordId: 'a' },
    ]);
    expect(states.get('a')).toEqual({ reversed: true, reversalId: 'rev_a' });
    expect(states.get('b')).toEqual({ reversed: false, reversalId: null });
    expect(states.has('rev_a')).toBe(false);
  });

  it('allows an allocation only from a live receipt, within what is unapplied and what the milestone still owes', () => {
    const base = { status: 'recorded' as const, unapplied: 50000, milestoneRemaining: 30000, amount: 30000 };
    expect(checkAllocation(base)).toEqual({ ok: true });
    expect(checkAllocation({ ...base, status: 'verified' })).toEqual({ ok: true });
    expect(fails(checkAllocation({ ...base, status: 'reversed' }))).toBe(true);
    expect(fails(checkAllocation({ ...base, status: 'rejected' }))).toBe(true);
    expect(checkAllocation({ ...base, amount: 50001 })).toMatchObject({ ok: false, kind: 'conflict', message: expect.stringContaining('50,000') });
    expect(checkAllocation({ ...base, amount: 30001 })).toMatchObject({ ok: false, message: expect.stringContaining('30,000') });
    expect(checkAllocation({ ...base, amount: 0 })).toMatchObject({ ok: false, kind: 'invalid' });
  });

  it('refunds only unapplied money from a live receipt', () => {
    expect(checkRefund({ status: 'verified', unapplied: 8000, amount: 8000 })).toEqual({ ok: true });
    expect(checkRefund({ status: 'recorded', unapplied: 8000, amount: 8001 })).toMatchObject({
      ok: false,
      message: expect.stringContaining('Reverse its allocation'),
    });
    expect(fails(checkRefund({ status: 'reversed', unapplied: 8000, amount: 1 }))).toBe(true);
  });

  it('verifies a recorded receipt once, rejects only an unverified unapplied one, and reverses a live one with no refunds', () => {
    expect(checkVerify('recorded')).toEqual({ ok: true });
    expect(fails(checkVerify('verified'))).toBe(true);
    expect(fails(checkVerify('reversed'))).toBe(true);
    expect(checkReject({ status: 'recorded', activeAllocations: 0 })).toEqual({ ok: true });
    expect(checkReject({ status: 'recorded', activeAllocations: 1 })).toMatchObject({
      ok: false,
      message: expect.stringContaining('Reverse its allocations'),
    });
    expect(checkReject({ status: 'verified', activeAllocations: 0 })).toMatchObject({
      ok: false,
      message: expect.stringContaining('reverse it instead'),
    });
    expect(checkReverseReceipt({ status: 'verified', refunded: 0 })).toEqual({ ok: true });
    expect(checkReverseReceipt({ status: 'recorded', refunded: 1 })).toMatchObject({ ok: false, message: expect.stringContaining('refunds') });
    expect(fails(checkReverseReceipt({ status: 'rejected', refunded: 0 }))).toBe(true);
  });

  it('takes proof of payment only for a live receipt that is held for an event', () => {
    expect(checkAttachEvidence({ status: 'recorded', hasEvent: true })).toEqual({ ok: true });
    expect(checkAttachEvidence({ status: 'verified', hasEvent: true })).toEqual({ ok: true });
    expect(checkAttachEvidence({ status: 'recorded', hasEvent: false })).toMatchObject({
      ok: false,
      message: expect.stringContaining('which event'),
    });
    expect(fails(checkAttachEvidence({ status: 'rejected', hasEvent: true }))).toBe(true);
    expect(fails(checkAttachEvidence({ status: 'reversed', hasEvent: true }))).toBe(true);
  });

  it('assigns an event once to a live receipt that has none, and never moves one between events', () => {
    expect(checkEarmark({ status: 'recorded', hasEvent: false })).toEqual({ ok: true });
    expect(checkEarmark({ status: 'verified', hasEvent: false })).toEqual({ ok: true });
    expect(checkEarmark({ status: 'recorded', hasEvent: true })).toMatchObject({
      ok: false,
      message: expect.stringContaining('already held'),
    });
    expect(fails(checkEarmark({ status: 'rejected', hasEvent: false }))).toBe(true);
    expect(fails(checkEarmark({ status: 'reversed', hasEvent: false }))).toBe(true);
  });

  it('reverses a payment once, and never a reversal', () => {
    expect(checkReverseAllocation({ amountReceived: 5000, reversesRecordId: null }, false)).toEqual({ ok: true });
    expect(checkReverseAllocation({ amountReceived: 5000, reversesRecordId: null }, true)).toMatchObject({
      ok: false,
      message: 'This payment was already reversed',
    });
    expect(fails(checkReverseAllocation({ amountReceived: -5000, reversesRecordId: 'a' }, false))).toBe(true);
  });

  it('flags a possible duplicate only on the same amount, method, day and a named payer', () => {
    const existing = { id: 'r1', amount: 20000, method: 'GCash', receivedDate: '2026-11-10', payerName: 'Ana Reyes' };
    const probe = { amount: 20000, method: 'GCash', receivedDate: '2026-11-10', payerName: ' ana reyes ' };
    expect(findPossibleDuplicate([existing], probe)?.id).toBe('r1');
    expect(findPossibleDuplicate([existing], { ...probe, amount: 20001 })).toBeUndefined();
    expect(findPossibleDuplicate([existing], { ...probe, receivedDate: '2026-11-11' })).toBeUndefined();
    // Without a payer there is nothing to compare, so no flag rather than a guess.
    expect(findPossibleDuplicate([existing], { ...probe, payerName: '' })).toBeUndefined();
  });
});
