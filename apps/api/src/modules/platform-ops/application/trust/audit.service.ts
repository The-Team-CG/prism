import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { OpsAuditChainLock, OpsAuditLog, OpsLoginHistory, OpsSecurityAlert, OpsUser, Prisma } from '@prisma/client';
import { PrismaService } from '@prism/kernel/database';
import { toPrismaJson } from '@prism/kernel/database';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import {
  AuditActionType,
  AuditCategory,
  LoginHistoryStatus,
  NotificationChannel,
  OpsUserRole,
} from '@prism/kernel/event-core';
import { mapAuditLog } from './audit.mappers';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { AuditChainBreakReason } from './audit-chain-order';
import { auditTailCandidates, isIndependentAuditChainSet, orderLinkedAuditLogs } from './audit-chain-order';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';

type AuditLogFilters = {
  query?: string;
  category?: string;
  eventId?: string;
  actor?: string;
  actionType?: string;
  severity?: string;
  dateRange?: string;
  from?: string;
  to?: string;
  limit?: string;
};

export type AuditLogInput = {
  eventId?: string;
  actor: string;
  actorRole?: string;
  actorEmail?: string;
  action: string;
  actionType?: string;
  category?: string;
  affectedType?: string;
  affectedId?: string;
  affectedLabel?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  device?: string;
  severity?: string;
  previousHash?: string | null;
  createdAt?: Date;
};

export type IntegrityIncidentInput = {
  source: string;
  reason: string;
  eventId?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
};

export type AuditIntegrityConflictKind = 'ambiguous_tail' | 'broken_chain';

export class AuditIntegrityConflictException extends ConflictException {
  constructor(
    message: string,
    readonly kind: AuditIntegrityConflictKind,
    readonly breakReason: AuditChainBreakReason | null = null,
  ) {
    super(message);
  }
}

export type AuthAuditIntegrityPosture = 'fail_closed' | 'degraded';

/**
 * Whether an unverifiable audit chain blocks authentication.
 *
 * Fail-closed is the default and the right posture for tamper evidence, but it
 * is also a platform-wide denial of service that a single bad row can trigger,
 * and it locks out the very operators who need to investigate. The escape hatch
 * is deliberate, opt-in, and always recorded as a critical incident, so
 * restoring access never requires editing the audit trail.
 */
export function resolveAuthAuditIntegrityPosture(): AuthAuditIntegrityPosture {
  return process.env.AUTH_AUDIT_INTEGRITY_POSTURE === 'degraded' ? 'degraded' : 'fail_closed';
}

const BULK_EXPORT_ALERT_THRESHOLD = 25;
const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_MINUTES = 10;
const PERMANENT_LOCKOUT_THRESHOLD = 5;
const AUDIT_READ_PAGE_SIZE = 1000;

type AuditReader = Pick<Prisma.TransactionClient, 'opsAuditLog'>;

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

function timestamp(value: Date) {
  return value.toISOString();
}

function addMinutes(value: Date, minutes: number) {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

const AUDIT_EQUAL_FILTERS = ['category', 'eventId', 'actor', 'actionType', 'severity'] as const;
const DATE_RANGE_DAYS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30 };

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

function applyAuditEqualFilters(where: Prisma.OpsAuditLogWhereInput, input: AuditLogFilters) {
  for (const key of AUDIT_EQUAL_FILTERS) {
    const value = input[key];
    if (value && value !== 'all') where[key] = value;
  }
}

function applyAuditQuery(where: Prisma.OpsAuditLogWhereInput, query?: string) {
  if (!query) return;
  where.OR = [
    { actor: { contains: query, mode: 'insensitive' } },
    { action: { contains: query, mode: 'insensitive' } },
    { affectedLabel: { contains: query, mode: 'insensitive' } },
  ];
}

function createdAtFromDateRange(dateRange: string, now: Date) {
  const from = new Date(now);
  const days = DATE_RANGE_DAYS[dateRange];
  if (days) from.setDate(from.getDate() - days);
  return { gte: from };
}

function applyAuditDateFilters(where: Prisma.OpsAuditLogWhereInput, input: AuditLogFilters) {
  if (input.dateRange && input.dateRange !== 'all') {
    where.createdAt = createdAtFromDateRange(input.dateRange, new Date());
  }
  if (input.from || input.to) {
    where.createdAt = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
  }
}

function matchNeedleTable(value: string, table: Array<[string, string]>, fallback: string) {
  for (const [needle, mapped] of table) {
    if (value.includes(needle)) return mapped;
  }
  return fallback;
}

type LockoutState = {
  nextFailedCount: number;
  shouldLock: boolean;
  nextLockoutCount: number;
  permanentLockout: boolean;
};

function lockoutState(user: OpsUser): LockoutState {
  const nextFailedCount = user.failedLoginCount + 1;
  const shouldLock = nextFailedCount >= LOGIN_LOCKOUT_THRESHOLD;
  const nextLockoutCount = shouldLock ? user.lockoutCount + 1 : user.lockoutCount;
  const permanentLockout = nextLockoutCount >= PERMANENT_LOCKOUT_THRESHOLD;
  return { nextFailedCount, shouldLock, nextLockoutCount, permanentLockout };
}

function lockoutUserData(user: OpsUser, now: Date, state: LockoutState) {
  return {
    failedLoginCount: state.shouldLock ? 0 : state.nextFailedCount,
    lockoutCount: state.nextLockoutCount,
    lockedUntil: state.shouldLock && !state.permanentLockout ? addMinutes(now, LOGIN_LOCKOUT_MINUTES) : user.lockedUntil,
    permanentLockout: state.permanentLockout,
  };
}

function lockoutHistory(state: LockoutState) {
  return {
    status: state.shouldLock ? LoginHistoryStatus.Locked : LoginHistoryStatus.Failed,
    reason: state.shouldLock ? 'Account locked after repeated failed attempts' : 'Invalid password',
    severity: state.shouldLock ? 'critical' : 'warning',
  };
}

function lockoutAlertPayload(user: OpsUser, state: LockoutState) {
  return {
    type: state.permanentLockout ? 'permanent_account_lockout' : 'account_lockout',
    title: state.permanentLockout ? 'Permanent account lockout' : 'Account lockout triggered',
    description: `${user.email} was locked after repeated failed login attempts.`,
    severity: state.permanentLockout ? 'critical' : 'warning',
    triggeredBy: user.email,
    metadata: { userId: user.id, role: user.role, lockoutCount: state.nextLockoutCount },
  };
}

function authenticationIntegrityMetadata(input: AuditLogInput, error: AuditIntegrityConflictException) {
  const metadata: Record<string, unknown> = { integrityKind: error.kind };
  if (error.breakReason) metadata.breakReason = error.breakReason;

  const optionalEntries: Array<[string, unknown]> = [
    ['actionType', input.actionType],
    ['category', input.category],
    ['affectedType', input.affectedType],
    ['affectedId', input.affectedId],
    ['affectedLabel', input.affectedLabel],
  ];
  for (const [key, value] of optionalEntries) {
    if (value !== undefined) metadata[key] = value;
  }
  return metadata;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationOutbox?: NotificationOutboxService,
  ) {}

  async listLoginHistory(userId: string) {
    const entries = await this.prisma.opsLoginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return entries.map((entry: OpsLoginHistory) => this.mapLoginHistory(entry));
  }

  async listAuditLogs(input: AuditLogFilters = {}) {
    const where = this.auditWhere(input);
    const take = Math.min(Math.max(Number(input.limit ?? 100) || 100, 1), 500);

    const logs = await this.prisma.opsAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: input.limit is clamped to 1..500 above.
      take,
    });

    return logs.map((log: OpsAuditLog) => this.mapAuditLog(log));
  }

  async exportAuditLogs(input: AuditLogFilters = {}, actor?: Pick<PrismVerifiedEventActor, 'id' | 'name' | 'role' | 'email'>) {
    const logs = await this.listAuditLogs({ ...input, limit: input.limit ?? '500' });

    await this.audit(undefined, actor?.name ?? 'System', `Exported audit log (${logs.length} records)`, {
      actorRole: actor?.role ?? OpsUserRole.System,
      actorEmail: actor?.email,
      actionType: AuditActionType.Export,
      category: AuditCategory.Access,
      affectedType: 'audit_logs',
      affectedLabel: `${logs.length} records`,
      metadata: { filters: input, recordCount: logs.length, actorId: actor?.id ?? null },
    });

    if (logs.length >= BULK_EXPORT_ALERT_THRESHOLD) {
      await this.createSecurityAlert({
        type: 'bulk_export',
        title: 'Bulk audit export threshold exceeded',
        description: `${actor?.name ?? 'System'} exported ${logs.length} audit records.`,
        severity: 'warning',
        triggeredBy: actor?.name ?? 'System',
        metadata: { filters: input, recordCount: logs.length, threshold: BULK_EXPORT_ALERT_THRESHOLD, actorId: actor?.id ?? null, actorEmail: actor?.email ?? null },
      });
    }

    return {
      exportedAt: new Date().toISOString(),
      recordCount: logs.length,
      rows: logs,
    };
  }

  async listSecurityAlerts() {
    const alerts = await this.prisma.opsSecurityAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return alerts.map((alert: OpsSecurityAlert) => this.mapSecurityAlert(alert));
  }

  async verifyIntegrity() {
    const logs = await loadAuditLogs(this.prisma);
    let previousHash: string | null = null;
    let lastVerifiedHash: string | null = null;
    const chain = orderLinkedAuditLogs(logs);
    const tails = auditTailCandidates(logs);
    const ambiguousTail = isIndependentAuditChainSet(logs, (log) => this.hasValidImmutableHash(log));
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
      const expectedHash = this.expectedAuditHash(log);

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

  async audit(
    eventId: string | undefined,
    actor: string,
    action: string,
    options: Omit<AuditLogInput, 'eventId' | 'actor' | 'action'> = {},
    context?: PrismTransactionContext,
  ): Promise<OpsAuditLog> {
    if (!context) {
      return this.prisma.$transaction((prisma) => this.audit(eventId, actor, action, options, { prisma, correlationId: randomUUID() }));
    }
    const prisma = context.prisma;
    // A real row update locks appenders and rejects stale serializable snapshots.
    // An advisory lock alone would not refresh a caller's earlier snapshot.
    const chainLock = await prisma.opsAuditChainLock.update({ where: { id: 'global' }, data: { revision: { increment: 1 } } });
    const previous = await this.auditTail(prisma, chainLock);

    const created = await prisma.opsAuditLog.create({
      data: this.buildAuditData({
        ...options,
        eventId,
        actor,
        action,
        previousHash: previous?.immutableHash || null,
        createdAt: new Date(Math.max(Date.now(), (previous?.createdAt.getTime() ?? 0) + 1)),
      }),
    });
    await prisma.opsAuditChainLock.update({
      where: { id: 'global' },
      data: { headId: created.id, headHash: created.immutableHash },
    });
    return created;
  }

  async recordAuthenticationAudit(input: AuditLogInput) {
    const { eventId, actor, action, ...options } = input;
    try {
      return await this.audit(eventId, actor, action, options);
    } catch (error) {
      if (!(error instanceof AuditIntegrityConflictException)) throw error;

      const reason = await this.recordAuthenticationIntegrityIncident(input, error);

      // A known two-root tail still degrades. An unverifiable chain blocks
      // authentication unless an operator has deliberately opted into degraded
      // mode to investigate.
      if (error.kind !== 'ambiguous_tail' && resolveAuthAuditIntegrityPosture() === 'fail_closed') {
        this.logger.error(`Authentication blocked by audit integrity failure: ${reason}`);
        throw error;
      }

      this.logger.error(`Authentication audit was skipped until integrity review: ${reason}`);
      return null;
    }
  }

  private async recordAuthenticationIntegrityIncident(input: AuditLogInput, error: AuditIntegrityConflictException) {
    const reason = error.message;
    // Every integrity classification is recorded before any decision about the
    // request. Security alerts are not chain-linked, so this write stays
    // available exactly when the audit chain does not.
    try {
      await this.recordIntegrityIncident({
        source: 'identity-access.authentication',
        reason,
        eventId: input.eventId,
        actor: input.actor,
        metadata: authenticationIntegrityMetadata(input, error),
      });
    } catch (incidentError) {
      const incidentMessage = incidentError instanceof Error ? incidentError.message : String(incidentError);
      this.logger.error(`Authentication audit integrity incident could not be persisted: ${incidentMessage}`);
      throw incidentError;
    }
    return reason;
  }

  private async auditTail(
    prisma: Prisma.TransactionClient,
    chainLock: Pick<OpsAuditChainLock, 'headId' | 'headHash'>,
  ) {
    if (chainLock.headId || chainLock.headHash) {
      if (!chainLock.headId || !chainLock.headHash) {
        throw new AuditIntegrityConflictException('Audit chain head metadata is incomplete; integrity review is required', 'broken_chain');
      }
      const head = await prisma.opsAuditLog.findUnique({ where: { id: chainLock.headId } });
      if (!head || head.immutableHash !== chainLock.headHash || !this.hasValidImmutableHash(head)) {
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
    // verifyIntegrity remains a full scan.
    return this.verifiedAuditTail(await loadAuditLogs(prisma));
  }

  private verifiedAuditTail(logs: OpsAuditLog[]) {
    if (logs.length === 0) return null;
    const chain = orderLinkedAuditLogs(logs);
    const tails = auditTailCandidates(logs);
    if (isIndependentAuditChainSet(logs, (log) => this.hasValidImmutableHash(log))) {
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
      if (log.previousHash !== previousHash || !this.hasValidImmutableHash(log)) {
        throw new AuditIntegrityConflictException(
          `Audit history is not a verified hash-linked chain (${log.id})`,
          'broken_chain',
        );
      }
      previousHash = log.immutableHash;
    }
    return tails[0];
  }

  async recordLoginHistory(
    user: OpsUser | null,
    email: string,
    status: string,
    failureReason?: string,
    metadata: { ipAddress?: string; device?: string } = {},
  ) {
    return this.prisma.opsLoginHistory.create({
      data: {
        id: `login_${randomUUID()}`,
        userId: user?.id ?? null,
        userName: user?.name ?? 'Unknown user',
        userRole: user?.role ?? OpsUserRole.Unknown,
        email,
        status,
        failureReason: failureReason ?? null,
        ipAddress: metadata.ipAddress ?? 'unknown',
        device: metadata.device ?? 'unknown',
      },
    });
  }

  async handleFailedLogin(user: OpsUser) {
    const now = new Date();
    const state = lockoutState(user);

    await this.prisma.opsUser.update({
      where: { id: user.id },
      data: lockoutUserData(user, now, state),
    });

    const history = lockoutHistory(state);
    await this.recordLoginHistory(user, user.email, history.status, history.reason);

    await this.recordAuthenticationAudit({
      actor: user.name,
      action: `Failed login attempt for ${user.email}`,
      actorRole: user.role,
      actorEmail: user.email,
      actionType: AuditActionType.LoginFailed,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: user.id,
      affectedLabel: user.email,
      severity: history.severity,
      metadata: { failedAttempt: state.nextFailedCount, lockoutCount: state.nextLockoutCount },
    });

    if (state.shouldLock) {
      await this.createSecurityAlert(lockoutAlertPayload(user, state), { authentication: true });
    }
  }

  async handleForbiddenAccess(user: OpsUser, email: string, reason: string) {
    await this.recordLoginHistory(user, email, LoginHistoryStatus.Blocked, reason);

    await this.recordAuthenticationAudit({
      actor: user.name,
      action: `403 forbidden access for ${email}: ${reason}`,
      actorRole: user.role,
      actorEmail: user.email,
      actionType: AuditActionType.ForbiddenAccess,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: user.id,
      affectedLabel: user.email,
      severity: 'warning',
      metadata: { reason },
    });

    const recentBlockedCount = await this.prisma.opsLoginHistory.count({
      where: {
        email,
        status: LoginHistoryStatus.Blocked,
        createdAt: { gte: addMinutes(new Date(), -30) },
      },
    });

    if (recentBlockedCount >= 3) {
      await this.createSecurityAlert({
        type: 'repeated_403',
        title: 'Repeated 403 Forbidden responses',
        description: `${email} triggered ${recentBlockedCount} forbidden access responses in the last 30 minutes.`,
        severity: 'critical',
        triggeredBy: email,
        metadata: { userId: user.id, role: user.role, recentBlockedCount },
      }, { authentication: true });
    }
  }

  async createSecurityAlert(
    input: {
      type: string;
      title: string;
      description: string;
      severity?: string;
      triggeredBy?: string;
      eventId?: string;
      metadata?: Record<string, unknown>;
    },
    options: { authentication?: boolean } = {},
  ) {
    const recipient = await this.resolveTrustRecipient();
    const notificationReady = Boolean(recipient && this.notificationOutbox);
    const metadata = {
      ...(input.metadata ?? {}),
      notification: notificationReady
        ? { status: 'queued', recipient, channels: [NotificationChannel.Email, NotificationChannel.Viber] }
        : { status: 'not_queued', reason: recipient ? 'Notification outbox is unavailable' : 'No approved PMCM trust recipient address is configured' },
    };
    const alert = await this.prisma.opsSecurityAlert.create({
      data: {
        id: `seca_${randomUUID()}`,
        eventId: input.eventId,
        type: input.type,
        title: input.title,
        description: input.description,
        severity: input.severity ?? 'warning',
        triggeredBy: input.triggeredBy ?? 'System',
        metadata: toPrismaJson(metadata),
      },
    });

    const auditOptions = {
      actorRole: OpsUserRole.System,
      actionType: input.type,
      category: AuditCategory.Access,
      affectedType: 'security_alert',
      affectedId: alert.id,
      affectedLabel: input.title,
      severity: input.severity ?? 'warning',
      metadata: input.metadata ?? {},
    };
    const auditWrite = { eventId: input.eventId, actor: 'System', action: input.title, ...auditOptions };
    await Promise.all([
      options.authentication ? this.recordAuthenticationAudit(auditWrite) : this.audit(input.eventId, 'System', input.title, auditOptions),
      ...(notificationReady
        ? [
            this.notify(input.eventId, recipient!, input.title, NotificationChannel.Email, `security-alert:${alert.id}:email`),
            this.notify(input.eventId, recipient!, input.title, NotificationChannel.Viber, `security-alert:${alert.id}:viber`),
          ]
        : []),
    ]);

    return alert;
  }

  notify(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: 'email' | 'viber' = NotificationChannel.Email,
    idempotencyKey?: string,
  ) {
    if (!this.notificationOutbox) {
      return Promise.reject(new Error('Notification outbox is unavailable'));
    }
    return this.notificationOutbox.queue(eventId, recipient, message, channel, { idempotencyKey });
  }

  async recordIntegrityIncident(input: IntegrityIncidentInput) {
    return this.prisma.opsSecurityAlert.create({
      data: {
        id: `seca_${randomUUID()}`,
        eventId: input.eventId,
        type: 'audit_integrity_incident',
        title: 'Audit record could not be persisted',
        description: input.reason,
        severity: 'critical',
        triggeredBy: input.actor ?? 'System',
        metadata: toPrismaJson({ source: input.source, reason: input.reason, ...(input.metadata ?? {}) }),
      },
    });
  }

  private async resolveTrustRecipient() {
    const recipient = await this.prisma.opsUser.findFirst({
      where: { role: OpsUserRole.PmcmAdmin, approvalStatus: 'approved' },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
    const email = recipient?.email?.trim().toLowerCase();
    return email && email.includes('@') ? email : null;
  }

  private buildAuditData(input: AuditLogInput) {
    const createdAt = input.createdAt ?? new Date();
    const id = `aud_${randomUUID()}`;
    const payload = {
      id,
      eventId: input.eventId ?? null,
      actor: input.actor,
      actorRole: input.actorRole ?? this.inferActorRole(input.actor),
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      actionType: input.actionType ?? this.inferActionType(input.action),
      category: input.category ?? this.inferCategory(input.action),
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
    const immutableHash = this.hashAuditPayload(payload);

    return {
      ...payload,
      metadata: toPrismaJson(payload.metadata),
      immutableHash,
      createdAt,
    };
  }

  private expectedAuditHash(log: Pick<OpsAuditLog, 'id' | 'eventId' | 'actor' | 'actorRole' | 'actorEmail' | 'action' | 'actionType' | 'category' | 'affectedType' | 'affectedId' | 'affectedLabel' | 'metadata' | 'ipAddress' | 'device' | 'severity' | 'previousHash' | 'createdAt'>) {
    return this.hashAuditPayload({
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

  private hasValidImmutableHash(log: OpsAuditLog) {
    return log.immutableHash === this.expectedAuditHash(log);
  }

  private hashAuditPayload(payload: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private auditWhere(input: AuditLogFilters) {
    const where: Prisma.OpsAuditLogWhereInput = {};
    applyAuditEqualFilters(where, input);
    applyAuditQuery(where, input.query);
    applyAuditDateFilters(where, input);
    return where;
  }

  private inferActorRole(actor: string) {
    const value = actor.toLowerCase();
    if (value.includes('system')) return OpsUserRole.System;
    if (value.includes('client')) return OpsUserRole.Client;
    if (value.includes('supplier')) return OpsUserRole.Supplier;
    if (value.includes('finance')) return 'finance';
    if (value.includes('pmcm') || value.includes('mys')) return OpsUserRole.PmcmAdmin;
    return OpsUserRole.Coordinator;
  }

  private inferActionType(action: string) {
    return matchNeedleTable(action.toLowerCase(), ACTION_TYPE_NEEDLES, AuditActionType.General);
  }

  private inferCategory(action: string) {
    return matchNeedleTable(action.toLowerCase(), CATEGORY_NEEDLES, AuditCategory.Events);
  }

  mapAuditLog(log: OpsAuditLog) {
    return mapAuditLog(log);
  }

  private mapLoginHistory(entry: OpsLoginHistory) {
    return {
      id: entry.id,
      userId: entry.userId,
      userName: entry.userName,
      userRole: entry.userRole,
      email: entry.email,
      status: entry.status,
      ipAddress: entry.ipAddress,
      device: entry.device,
      failureReason: entry.failureReason,
      createdAt: timestamp(entry.createdAt),
    };
  }

  private mapSecurityAlert(alert: OpsSecurityAlert) {
    return {
      id: alert.id,
      eventId: alert.eventId,
      type: alert.type,
      title: alert.title,
      description: alert.description,
      severity: alert.severity,
      status: alert.status,
      triggeredBy: alert.triggeredBy,
      metadata: alert.metadata,
      createdAt: timestamp(alert.createdAt),
      resolvedAt: alert.resolvedAt ? timestamp(alert.resolvedAt) : null,
    };
  }
}
