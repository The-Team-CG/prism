import { describe, expect, it } from 'vitest';
import { auditTailCandidates, isIndependentAuditChainSet, orderLinkedAuditLogs, selectTiedAuditTail } from './audit-chain-order';

describe('historical audit ordering', () => {
  const root = { id: 'z', immutableHash: 'root', previousHash: null };
  const tail = { id: 'a', immutableHash: 'tail', previousHash: 'root' };
  it('uses hash links when UUID ordering reverses same-time history', () => {
    expect(orderLinkedAuditLogs([tail, root])).toEqual({ ordered: [root, tail], firstBrokenLogId: null });
    expect(selectTiedAuditTail([tail, root])).toBe(tail);
  });
  it('rejects forks instead of choosing a convenient leaf', () => {
    const fork = { id: 'f', immutableHash: 'fork', previousHash: 'root' };
    expect(orderLinkedAuditLogs([root, tail, fork]).firstBrokenLogId).toBe('f');
    expect(selectTiedAuditTail([root, tail, fork])).toBeUndefined();
  });
  it('reports missing history and cycles', () => {
    expect(orderLinkedAuditLogs([tail]).firstBrokenLogId).toBe('a');
    expect(orderLinkedAuditLogs([{ ...root, previousHash: 'tail' }, tail]).firstBrokenLogId).not.toBeNull();
  });
  it('finds the reachable leaf across the whole chain when timestamps tie', () => {
    const sameTimeTail = { ...tail, id: 'same-time-tail' };
    expect(auditTailCandidates([sameTimeTail, root])).toEqual([sameTimeTail]);
  });
  it('reports every leaf when a historical fork needs operator review', () => {
    const fork = { id: 'f', immutableHash: 'fork', previousHash: 'root' };
    expect(auditTailCandidates([root, tail, fork]).map((row) => row.id)).toEqual(['a', 'f']);
  });
  it('recognizes separate valid roots without treating a fork as historical drift', () => {
    const otherRoot = { id: 'other-root', immutableHash: 'other-root-hash', previousHash: null };
    const otherTail = { id: 'other-tail', immutableHash: 'other-tail-hash', previousHash: 'other-root-hash' };

    expect(isIndependentAuditChainSet([root, tail, otherRoot, otherTail])).toBe(true);
    expect(isIndependentAuditChainSet([root, tail, { id: 'fork', immutableHash: 'fork', previousHash: 'root' }])).toBe(false);
  });
});
