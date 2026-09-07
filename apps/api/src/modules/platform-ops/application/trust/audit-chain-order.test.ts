import { describe, expect, it } from 'vitest';
import { orderLinkedAuditLogs, selectTiedAuditTail } from './audit-chain-order';

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
});
