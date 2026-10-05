import { createHash } from 'node:crypto';
import { orderLinkedAuditLogs } from './audit-chain-order';
import { hashCanonicalAuditPayload, isAuditHashValid, toAuditHashPayload } from './audit-hash';
import type { AuditHashRow } from './audit-hash';

export type AuditChainLockSnapshot = {
  id: string;
  revision: number;
  headId: string | null;
  headHash: string | null;
};

export type AuditDatabaseIdentity = {
  database: string;
  host: string;
};

export type AuditChainRehashPlan = {
  ordered: AuditHashRow[];
  plannedRows: AuditHashRow[];
  invalidHashCount: number;
  rootId: string;
  oldRootHash: string;
  tailId: string;
  oldTailHash: string;
  newRootHash: string;
  newTailHash: string;
};

export function validateAuditChainLock(lock: AuditChainLockSnapshot, plan: AuditChainRehashPlan) {
  if (lock.headId === null && lock.headHash === null) return;
  if (lock.headId !== plan.tailId || lock.headHash !== plan.oldTailHash) {
    throw new Error('The audit-chain lock head does not match the linked history tail');
  }
}

export function computeAuditSourceSha256(
  target: AuditDatabaseIdentity,
  rows: AuditHashRow[],
  lock: AuditChainLockSnapshot,
) {
  return createHash('sha256')
    .update(JSON.stringify(normalizeSnapshotValue({ target, lock, rows })))
    .digest('hex');
}

export function planAuditChainRehash(rows: AuditHashRow[]): AuditChainRehashPlan {
  for (const row of rows) {
    if (!/^[0-9a-f]{64}$/.test(row.immutableHash)) {
      throw new Error(`Cannot repair a missing or malformed audit hash (${row.id})`);
    }
    if (row.previousHash !== null && !/^[0-9a-f]{64}$/.test(row.previousHash)) {
      throw new Error(`Cannot repair a malformed previous hash (${row.id})`);
    }
  }
  const chain = orderLinkedAuditLogs(rows);
  if (chain.firstBrokenLogId) {
    throw new Error(`Audit links are not a single chain (${chain.breakReason ?? 'unknown'} at ${chain.firstBrokenLogId})`);
  }
  if (chain.ordered.length === 0) throw new Error('Audit history is empty; there is nothing to repair');

  const ordered = chain.ordered;
  const invalidHashCount = ordered.filter((row) => !isAuditHashValid(row)).length;
  let previousHash: string | null = null;
  const plannedRows = ordered.map((row) => {
    const payload = toAuditHashPayload({ ...row, previousHash });
    const immutableHash = hashCanonicalAuditPayload(payload);
    const planned = { ...row, previousHash, immutableHash };
    previousHash = immutableHash;
    return planned;
  });

  return {
    ordered,
    plannedRows,
    invalidHashCount,
    rootId: ordered[0].id,
    oldRootHash: ordered[0].immutableHash,
    tailId: ordered[ordered.length - 1].id,
    oldTailHash: ordered[ordered.length - 1].immutableHash,
    newRootHash: plannedRows[0].immutableHash,
    newTailHash: plannedRows[plannedRows.length - 1].immutableHash,
  };
}

export function verifyCanonicalAuditChain(rows: AuditHashRow[]) {
  const chain = orderLinkedAuditLogs(rows);
  if (chain.firstBrokenLogId) return false;

  let previousHash: string | null = null;
  for (const row of chain.ordered) {
    if (row.previousHash !== previousHash) return false;
    if (row.immutableHash !== hashCanonicalAuditPayload(toAuditHashPayload(row))) return false;
    previousHash = row.immutableHash;
  }
  return chain.ordered.length > 0;
}

function normalizeSnapshotValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeSnapshotValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, child]) => [key, normalizeSnapshotValue(child)]));
}
