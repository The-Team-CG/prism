import type { OpsAuditChainLock, OpsAuditLog, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { toPrismaJson } from '@prism/kernel/database';
import type { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { auditTailCandidates, isIndependentAuditChainSet, orderLinkedAuditLogs } from './audit-chain-order';
import { AuditIntegrityConflictException } from './audit-chain.types';
import type { AuditLogInput } from './audit-chain.types';

const AUDIT_READ_PAGE_SIZE = 1000;

type AuditReader = Pick<Prisma.TransactionClient, 'opsAuditLog'>;
type AuditAppendInput = {
  eventId?: string;
  actor: string;
  action: string;
  options?: Omit<AuditLogInput, 'eventId' | 'actor' | 'action'>;
  context?: PrismTransactionContext;
};

async function loadAuditLogs(prisma: AuditReader) {
  if (typeof prisma.opsAuditLog.findMany !== 'function') return [];
  const logs: Array<Awaited<ReturnType<AuditReader['opsAuditLog']['findMany']>>[number]> = [];
  // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: integrity checks must read the full ordered chain in fixed-size pages.
  for (let skip = 0; ; skip += AUDIT_READ_PAGE_SIZE) {
    const page = await prisma.opsAuditLog.findMany({
      take: AUDIT_READ_PAGE_SIZE,
      // QUERY_AUDIT_ALLOW_OFFSET: ordered full-chain verification advances through 1000-row pages.
      skip,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    logs.push(...page);
    if (page.length < AUDIT_READ_PAGE_SIZE) return logs;
  }
}

const ACTION_TYPE_NEEDLES: Array<[string, string]> = [
  ['created', AuditActionType.Create],
  ['uploaded', AuditActionType.Upload],
  ['approved', AuditActionType.Approve],
  ['declined', AuditActionType.Decline],
  ['assigned', AuditActionType.Assign],
  ['archived', AuditActionType.Archive],
  ['resolved', AuditActionType.Resolve],
  ['marked', AuditActionType.Update],
  ['updated', AuditActionType.Update],
  ['signed in', AuditActionType.Login],
  ['failed login', AuditActionType.LoginFailed],
];

const CATEGORY_NEEDLES: Array<[string, string]> = [
  ['billing', AuditCategory.Finance],
  ['payment', AuditCategory.Finance],
  ['supplier', AuditCategory.Suppliers],
  ['quote', AuditCategory.Suppliers],
  ['portal', AuditCategory.Access],
  ['access', AuditCategory.Access],
  ['login', AuditCategory.Access],
  ['signed in', AuditCategory.Access],
  ['document', AuditCategory.Documents],
  ['conforme', AuditCategory.Documents],
];

function matchNeedleTable(value: string, table: Array<[string, string]>, fallback: string) {
  for (const [needle, mapped] of table) {
    if (value.includes(needle)) return mapped;
  }
  return fallback;
}

export async function appendAuditLog(
  prisma: PrismaService,
  input: AuditAppendInput,
): Promise<OpsAuditLog> {
  const { eventId, actor, action, options = {}, context } = input;
  if (!context) {
    return prisma.$transaction((transaction) =>
      appendAuditLog(prisma, { ...input, context: { prisma: transaction, correlationId: randomUUID() } }),
    );
  }

  const transaction = context.prisma;
  // A real row update locks appenders and rejects stale serializable snapshots.
  // An advisory lock alone would not refresh a caller's earlier snapshot.
  const chainLock = await transaction.opsAuditChainLock.update({
    where: { id: 'global' },
    data: { revision: { increment: 1 } },
  });
  const previous = await auditTail(transaction, chainLock);

  const created = await transaction.opsAuditLog.create({
    data: buildAuditData({
      ...options,
      eventId,
      actor,
      action,
      previousHash: previous?.immutableHash || null,
      createdAt: new Date(Math.max(Date.now(), (previous?.createdAt.getTime() ?? 0) + 1)),
    }),
  });
  await transaction.opsAuditChainLock.update({
    where: { id: 'global' },
    data: { headId: created.id, headHash: created.immutableHash },
  });
  return created;
}

export async function verifyAuditIntegrity(prisma: AuditReader) {
  const logs = await loadAuditLogs(prisma);
  let previousHash: string | null = null;
  let lastVerifiedHash: string | null = null;
  const chain = orderLinkedAuditLogs(logs);
  const tails = auditTailCandidates(logs);
  const ambiguousTail = isIndependentAuditChainSet(logs, hasValidImmutableHash);
  if (chain.firstBrokenLogId) {
    return {
      valid: false,
      checkedCount: logs.length,
      firstBrokenLogId: chain.firstBrokenLogId,
      breakReason: chain.breakReason,
      ambiguousTail,
      ambiguousTailLogIds: ambiguousTail ? tails.map((tail) => tail.id) : [],
      lastVerifiedHash,
      checkedAt: new Date().toISOString(),
    };
  }
  for (const log of chain.ordered) {
    const expectedHash = expectedAuditHash(log);

    if (log.previousHash !== previousHash || log.immutableHash !== expectedHash) {
      return {
        valid: false,
        checkedCount: logs.length,
        firstBrokenLogId: log.id,
        breakReason: null,
        ambiguousTail: false,
        ambiguousTailLogIds: [],
        lastVerifiedHash,
        checkedAt: new Date().toISOString(),
      };
    }

    previousHash = log.immutableHash;
    lastVerifiedHash = log.immutableHash;
  }

  return {
    valid: true,
    checkedCount: logs.length,
    firstBrokenLogId: null,
    breakReason: null,
    ambiguousTail: false,
    ambiguousTailLogIds: [],
    lastVerifiedHash,
    checkedAt: new Date().toISOString(),
  };
}

async function auditTail(
  prisma: Prisma.TransactionClient,
  chainLock: Pick<OpsAuditChainLock, 'headId' | 'headHash'>,
) {
  if (chainLock.headId || chainLock.headHash) {
    if (!chainLock.headId || !chainLock.headHash) {
      throw new AuditIntegrityConflictException('Audit chain head metadata is incomplete; integrity review is required', 'broken_chain');
    }
    const head = await prisma.opsAuditLog.findUnique({ where: { id: chainLock.headId } });
    if (!head || head.immutableHash !== chainLock.headHash || !hasValidImmutableHash(head)) {
      throw new AuditIntegrityConflictException('Audit chain head does not match its verified hash; integrity review is required', 'broken_chain');
    }
    const untrackedRow = await prisma.opsAuditLog.findFirst({
      where: { createdAt: { gte: head.createdAt }, id: { not: head.id } },
      select: { id: true },
    });
    if (!untrackedRow) return head;
  }

  // Existing installations bootstrap the verified head once. Later appends
  // read only the head row unless an older writer left an untracked tail.
  // verifyAuditIntegrity remains a full scan.
  return verifiedAuditTail(await loadAuditLogs(prisma));
}

function verifiedAuditTail(logs: OpsAuditLog[]) {
  if (logs.length === 0) return null;
  const chain = orderLinkedAuditLogs(logs);
  const tails = auditTailCandidates(logs);
  if (isIndependentAuditChainSet(logs, hasValidImmutableHash)) {
    throw new AuditIntegrityConflictException('Audit history has an ambiguous tail; integrity review is required', 'ambiguous_tail');
  }
  if (chain.firstBrokenLogId || tails.length !== 1) {
    throw new AuditIntegrityConflictException(
      `Audit history is not a single hash-linked chain; integrity review is required (${chain.firstBrokenLogId ?? 'unknown'})`,
      'broken_chain',
      chain.breakReason,
    );
  }
  let previousHash: string | null = null;
  for (const log of chain.ordered) {
    if (log.previousHash !== previousHash || !hasValidImmutableHash(log)) {
      throw new AuditIntegrityConflictException(
        `Audit history is not a verified hash-linked chain (${log.id})`,
        'broken_chain',
      );
    }
    previousHash = log.immutableHash;
  }
  return tails[0];
}

function buildAuditData(input: AuditLogInput) {
  const createdAt = input.createdAt ?? new Date();
  const id = `aud_${randomUUID()}`;
  const payload = {
    id,
    eventId: input.eventId ?? null,
    actor: input.actor,
    actorRole: input.actorRole ?? inferActorRole(input.actor),
    actorEmail: input.actorEmail ?? null,
    action: input.action,
    actionType: input.actionType ?? inferActionType(input.action),
    category: input.category ?? inferCategory(input.action),
    affectedType: input.affectedType ?? null,
    affectedId: input.affectedId ?? null,
    affectedLabel: input.affectedLabel ?? null,
    metadata: input.metadata ?? {},
    ipAddress: input.ipAddress ?? 'unknown',
    device: input.device ?? 'unknown',
    severity: input.severity ?? 'info',
    previousHash: input.previousHash ?? null,
    createdAt: createdAt.toISOString(),
  };
  const immutableHash = hashAuditPayload(payload);

  return {
    ...payload,
    metadata: toPrismaJson(payload.metadata),
    immutableHash,
    createdAt,
  };
}

function expectedAuditHash(
  log: Pick<OpsAuditLog, 'id' | 'eventId' | 'actor' | 'actorRole' | 'actorEmail' | 'action' | 'actionType' | 'category' | 'affectedType' | 'affectedId' | 'affectedLabel' | 'metadata' | 'ipAddress' | 'device' | 'severity' | 'previousHash' | 'createdAt'>,
) {
  return hashAuditPayload({
    id: log.id,
    eventId: log.eventId ?? null,
    actor: log.actor,
    actorRole: log.actorRole,
    actorEmail: log.actorEmail ?? null,
    action: log.action,
    actionType: log.actionType,
    category: log.category,
    affectedType: log.affectedType ?? null,
    affectedId: log.affectedId ?? null,
    affectedLabel: log.affectedLabel ?? null,
    metadata: log.metadata ?? {},
    ipAddress: log.ipAddress,
    device: log.device,
    severity: log.severity,
    previousHash: log.previousHash ?? null,
    createdAt: log.createdAt.toISOString(),
  });
}

function hasValidImmutableHash(log: OpsAuditLog) {
  return log.immutableHash === expectedAuditHash(log);
}

function hashAuditPayload(payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function inferActorRole(actor: string) {
  const value = actor.toLowerCase();
  if (value.includes('system')) return OpsUserRole.System;
  if (value.includes('client')) return OpsUserRole.Client;
  if (value.includes('supplier')) return OpsUserRole.Supplier;
  if (value.includes('finance')) return 'finance';
  if (value.includes('pmcm') || value.includes('mys')) return OpsUserRole.PmcmAdmin;
  return OpsUserRole.Coordinator;
}

function inferActionType(action: string) {
  return matchNeedleTable(action.toLowerCase(), ACTION_TYPE_NEEDLES, AuditActionType.General);
}

function inferCategory(action: string) {
  return matchNeedleTable(action.toLowerCase(), CATEGORY_NEEDLES, AuditCategory.Events);
}
