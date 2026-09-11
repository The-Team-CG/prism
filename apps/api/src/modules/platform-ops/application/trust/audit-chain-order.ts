type LinkedAudit = { id: string; immutableHash: string; previousHash: string | null };

/** Hash links, not UUID order, preserve valid historical same-millisecond appends. */
export function orderLinkedAuditLogs<T extends LinkedAudit>(logs: T[]): { ordered: T[]; firstBrokenLogId: string | null } {
  const children = new Map<string | null, T>();
  const hashes = new Set<string>();
  for (const log of logs) {
    if (children.has(log.previousHash) || hashes.has(log.immutableHash)) return { ordered: [], firstBrokenLogId: log.id };
    children.set(log.previousHash, log);
    hashes.add(log.immutableHash);
  }
  const ordered: T[] = [];
  let next = children.get(null);
  while (next && ordered.length < logs.length) {
    ordered.push(next);
    next = children.get(next.immutableHash);
  }
  if (ordered.length !== logs.length || next) {
    const orderedIds = new Set(ordered.map((row) => row.id));
    return { ordered, firstBrokenLogId: logs.find((row) => !orderedIds.has(row.id))?.id ?? logs[0]?.id ?? null };
  }
  return { ordered, firstBrokenLogId: null };
}

/** Return every leaf in the complete hash graph. A valid chain has one leaf. */
export function auditTailCandidates<T extends LinkedAudit>(logs: T[]): T[] {
  const parentHashes = new Set(logs.map((row) => row.previousHash).filter((hash): hash is string => Boolean(hash)));
  const seenHashes = new Set<string>();
  return logs.filter((row) => {
    if (seenHashes.has(row.immutableHash)) return false;
    seenHashes.add(row.immutableHash);
    return !parentHashes.has(row.immutableHash);
  });
}

/** Distinguish separate linked historical chains from a fork or broken graph. */
export function isIndependentAuditChainSet<T extends LinkedAudit>(logs: T[]) {
  if (logs.length < 2) return false;
  const roots = logs.filter((row) => row.previousHash === null);
  if (roots.length < 2) return false;

  const byHash = new Map<string, T>();
  const children = new Map<string, T[]>();
  for (const log of logs) {
    if (byHash.has(log.immutableHash)) return false;
    byHash.set(log.immutableHash, log);
  }
  for (const log of logs) {
    if (log.previousHash === null) continue;
    if (!byHash.has(log.previousHash)) return false;
    const siblings = children.get(log.previousHash) ?? [];
    siblings.push(log);
    if (siblings.length > 1) return false;
    children.set(log.previousHash, siblings);
  }

  const visited = new Set<string>();
  for (const root of roots) {
    let current: T | undefined = root;
    while (current) {
      if (visited.has(current.immutableHash)) return false;
      visited.add(current.immutableHash);
      current = children.get(current.immutableHash)?.[0];
    }
  }
  return visited.size === logs.length && auditTailCandidates(logs).length === roots.length;
}

export function selectTiedAuditTail<T extends LinkedAudit>(logs: T[]): T | undefined {
  const parents = new Set(logs.map((row) => row.previousHash));
  const tails = logs.filter((row) => !parents.has(row.immutableHash));
  if (new Set(logs.map((row) => row.immutableHash)).size !== logs.length || tails.length !== 1) return undefined;
  return tails[0];
}
