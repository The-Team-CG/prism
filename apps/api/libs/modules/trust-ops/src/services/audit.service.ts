import { Injectable } from '@nestjs/common';
import type { OpsAuditLog, OpsLoginHistory, OpsSecurityAlert, OpsUser, Prisma } from '@prisma/client';
import type { PrismaService } from '@prism/database';
import { toPrismaJson } from '@prism/database';
import { createHash, randomUUID } from 'node:crypto';
import type { PrismTransactionContext } from '../../../../core/shared-kernel/src';
import {
  AuditActionType,
  AuditCategory,
  LoginHistoryStatus,
  NotificationChannel,
  OpsUserRole,
} from '@prism/modules/event-core';

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

const BULK_EXPORT_ALERT_THRESHOLD = 25;
const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_MINUTES = 10;
const PERMANENT_LOCKOUT_THRESHOLD = 5;

function timestamp(value: Date) {
  return value.toISOString();
}

function addMinutes(value: Date, minutes: number) {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

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
      take,
    });

    return logs.map((log: OpsAuditLog) => this.mapAuditLog(log));
  }

  async exportAuditLogs(input: AuditLogFilters = {}) {
    const logs = await this.listAuditLogs({ ...input, limit: input.limit ?? '500' });

    await this.audit(undefined, 'PMCM Admin', `Exported audit log (${logs.length} records)`, {
      actorRole: OpsUserRole.PmcmAdmin,
      actionType: AuditActionType.Export,
      category: AuditCategory.Access,
      affectedType: 'audit_logs',
      affectedLabel: `${logs.length} records`,
      metadata: { filters: input, recordCount: logs.length },
    });

    if (logs.length >= BULK_EXPORT_ALERT_THRESHOLD) {
      await this.createSecurityAlert({
        type: 'bulk_export',
        title: 'Bulk audit export threshold exceeded',
        description: `PMCM Admin exported ${logs.length} audit records.`,
        severity: 'warning',
        metadata: { filters: input, recordCount: logs.length, threshold: BULK_EXPORT_ALERT_THRESHOLD },
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
    const logs = await this.prisma.opsAuditLog.findMany({
      // QUERY_AUDIT_ALLOW_UNBOUNDED: integrity verification must scan the full audit hash chain.
      orderBy: { createdAt: 'asc' },
    });
    let previousHash: string | null = null;
    let lastVerifiedHash: string | null = null;

    for (const log of logs) {
      const expectedHash = this.hashAuditPayload({
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

      if (log.previousHash !== previousHash || log.immutableHash !== expectedHash) {
        return {
          valid: false,
          checkedCount: logs.length,
          firstBrokenLogId: log.id,
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
  ) {
    const prisma = context?.prisma ?? this.prisma;
    const previous = await prisma.opsAuditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { immutableHash: true },
    });

    return prisma.opsAuditLog.create({
      data: this.buildAuditData({
        eventId,
        actor,
        action,
        previousHash: previous?.immutableHash || null,
        ...options,
      }),
    });
  }

  async recordLoginHistory(
    user: OpsUser | null,
    email: string,
    status: string,
    failureReason?: string,
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
        ipAddress: '192.168.1.5',
        device: 'Local sample browser',
      },
    });
  }

  async handleFailedLogin(user: OpsUser) {
    const now = new Date();
    const nextFailedCount = user.failedLoginCount + 1;
    const shouldLock = nextFailedCount >= LOGIN_LOCKOUT_THRESHOLD;
    const nextLockoutCount = shouldLock ? user.lockoutCount + 1 : user.lockoutCount;
    const permanentLockout = nextLockoutCount >= PERMANENT_LOCKOUT_THRESHOLD;

    await this.prisma.opsUser.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : nextFailedCount,
        lockoutCount: nextLockoutCount,
        lockedUntil: shouldLock && !permanentLockout ? addMinutes(now, LOGIN_LOCKOUT_MINUTES) : user.lockedUntil,
        permanentLockout,
      },
    });

    await this.recordLoginHistory(
      user,
      user.email,
      shouldLock ? LoginHistoryStatus.Locked : LoginHistoryStatus.Failed,
      shouldLock ? 'Account locked after repeated failed attempts' : 'Invalid password',
    );

    await this.audit(undefined, user.name, `Failed login attempt for ${user.email}`, {
      actorRole: user.role,
      actorEmail: user.email,
      actionType: AuditActionType.LoginFailed,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: user.id,
      affectedLabel: user.email,
      severity: shouldLock ? 'critical' : 'warning',
      metadata: { failedAttempt: nextFailedCount, lockoutCount: nextLockoutCount },
    });

    if (shouldLock) {
      await this.createSecurityAlert({
        type: permanentLockout ? 'permanent_account_lockout' : 'account_lockout',
        title: permanentLockout ? 'Permanent account lockout' : 'Account lockout triggered',
        description: `${user.email} was locked after repeated failed login attempts.`,
        severity: permanentLockout ? 'critical' : 'warning',
        triggeredBy: user.email,
        metadata: { userId: user.id, role: user.role, lockoutCount: nextLockoutCount },
      });
    }
  }

  async handleForbiddenAccess(user: OpsUser, email: string, reason: string) {
    await this.recordLoginHistory(user, email, LoginHistoryStatus.Blocked, reason);

    await this.audit(undefined, user.name, `403 forbidden access for ${email}: ${reason}`, {
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
      });
    }
  }

  async createSecurityAlert(input: {
    type: string;
    title: string;
    description: string;
    severity?: string;
    triggeredBy?: string;
    eventId?: string;
    metadata?: Record<string, unknown>;
  }) {
    const alert = await this.prisma.opsSecurityAlert.create({
      data: {
        id: `seca_${randomUUID()}`,
        eventId: input.eventId,
        type: input.type,
        title: input.title,
        description: input.description,
        severity: input.severity ?? 'warning',
        triggeredBy: input.triggeredBy ?? 'System',
        metadata: toPrismaJson(input.metadata ?? {}),
      },
    });

    await Promise.all([
      this.audit(input.eventId, 'System', input.title, {
        actorRole: OpsUserRole.System,
        actionType: input.type,
        category: AuditCategory.Access,
        affectedType: 'security_alert',
        affectedId: alert.id,
        affectedLabel: input.title,
        severity: input.severity ?? 'warning',
        metadata: input.metadata ?? {},
      }),
      this.notify(input.eventId, 'Ms. Mys', input.title, NotificationChannel.Email),
      this.notify(input.eventId, 'Ms. Mys', input.title, NotificationChannel.Viber),
    ]);

    return alert;
  }

  notify(
    eventId: string | undefined,
    recipient: string,
    message: string,
    channel: 'email' | 'viber' = NotificationChannel.Email,
  ) {
    return this.prisma.opsNotificationLog.create({
      data: {
        id: `not_${randomUUID()}`,
        eventId,
        channel,
        recipient,
        message,
        status: 'queued',
      },
    });
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
      ipAddress: input.ipAddress ?? '192.168.1.5',
      device: input.device ?? 'Local sample browser',
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

  private hashAuditPayload(payload: Record<string, unknown>) {
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private auditWhere(input: AuditLogFilters) {
    const where: Prisma.OpsAuditLogWhereInput = {};
    if (input.category && input.category !== 'all') where.category = input.category;
    if (input.eventId && input.eventId !== 'all') where.eventId = input.eventId;
    if (input.actor && input.actor !== 'all') where.actor = input.actor;
    if (input.actionType && input.actionType !== 'all') where.actionType = input.actionType;
    if (input.severity && input.severity !== 'all') where.severity = input.severity;
    if (input.query) {
      where.OR = [
        { actor: { contains: input.query, mode: 'insensitive' } },
        { action: { contains: input.query, mode: 'insensitive' } },
        { affectedLabel: { contains: input.query, mode: 'insensitive' } },
      ];
    }

    const now = new Date();
    if (input.dateRange && input.dateRange !== 'all') {
      const from = new Date(now);
      if (input.dateRange === '24h') from.setDate(from.getDate() - 1);
      if (input.dateRange === '7d') from.setDate(from.getDate() - 7);
      if (input.dateRange === '30d') from.setDate(from.getDate() - 30);
      where.createdAt = { gte: from };
    }
    if (input.from || input.to) {
      where.createdAt = {
        ...(input.from ? { gte: new Date(input.from) } : {}),
        ...(input.to ? { lte: new Date(input.to) } : {}),
      };
    }

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
    const value = action.toLowerCase();
    if (value.includes('created')) return AuditActionType.Create;
    if (value.includes('uploaded')) return AuditActionType.Upload;
    if (value.includes('approved')) return AuditActionType.Approve;
    if (value.includes('declined')) return AuditActionType.Decline;
    if (value.includes('assigned')) return AuditActionType.Assign;
    if (value.includes('archived')) return AuditActionType.Archive;
    if (value.includes('resolved')) return AuditActionType.Resolve;
    if (value.includes('marked') || value.includes('updated')) return AuditActionType.Update;
    if (value.includes('signed in')) return AuditActionType.Login;
    if (value.includes('failed login')) return AuditActionType.LoginFailed;
    return AuditActionType.General;
  }

  private inferCategory(action: string) {
    const value = action.toLowerCase();
    if (value.includes('billing') || value.includes('payment')) return AuditCategory.Finance;
    if (value.includes('supplier') || value.includes('quote')) return AuditCategory.Suppliers;
    if (value.includes('portal') || value.includes('access') || value.includes('login') || value.includes('signed in')) return AuditCategory.Access;
    if (value.includes('document') || value.includes('conforme')) return AuditCategory.Documents;
    return AuditCategory.Events;
  }

  mapAuditLog(log: OpsAuditLog) {
    return {
      id: log.id,
      eventId: log.eventId ?? undefined,
      actor: log.actor,
      actorRole: log.actorRole,
      actorEmail: log.actorEmail,
      action: log.action,
      actionType: log.actionType,
      category: log.category,
      affectedType: log.affectedType,
      affectedId: log.affectedId,
      affectedLabel: log.affectedLabel,
      metadata: log.metadata,
      ipAddress: log.ipAddress,
      device: log.device,
      severity: log.severity,
      immutableHash: log.immutableHash,
      previousHash: log.previousHash,
      createdAt: timestamp(log.createdAt),
    };
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
