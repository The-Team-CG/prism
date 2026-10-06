import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { OpsLoginHistory, OpsSecurityAlert, OpsUser } from '@prisma/client';
import { PrismaService, toPrismaJson } from '@prism/kernel/database';
import { randomUUID } from 'node:crypto';
import {
  AuditActionType,
  AuditCategory,
  LoginHistoryStatus,
  NotificationChannel,
  OpsUserRole,
} from '@prism/kernel/event-core';
import { NotificationOutboxService } from '../notifications/notification-outbox.service';
import { AuditService, AuditIntegrityConflictException } from './audit.service';
import type { AuditLogInput } from './audit.service';
import type { AuthenticationFailureDetails } from '../../contracts/trust/authentication-failure-details';
import { ACCOUNT_CONTACT_READ_MODEL, type AccountContactReadModel } from '@prism/contexts/read-models/account-contacts';

export type IntegrityIncidentInput = {
  source: string;
  reason: string;
  eventId?: string;
  actor?: string;
  metadata?: Record<string, unknown>;
};

export type AuthAuditIntegrityPosture = 'fail_closed' | 'degraded';

/** Whether an unverifiable audit chain blocks authentication. */
export function resolveAuthAuditIntegrityPosture(): AuthAuditIntegrityPosture {
  return process.env.AUTH_AUDIT_INTEGRITY_POSTURE === 'degraded' ? 'degraded' : 'fail_closed';
}

function timestamp(value: Date) {
  return value.toISOString();
}

function addMinutes(value: Date, minutes: number) {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function lockoutHistory(state: AuthenticationFailureDetails) {
  return {
    status: state.lockoutTriggered ? LoginHistoryStatus.Locked : LoginHistoryStatus.Failed,
    reason: state.lockoutTriggered ? 'Account locked after repeated failed attempts' : state.failureReason,
    severity: state.lockoutTriggered ? 'critical' : 'warning',
  };
}

function lockoutAlertPayload(user: OpsUser, state: AuthenticationFailureDetails) {
  return {
    type: state.permanentLockout ? 'permanent_account_lockout' : 'account_lockout',
    title: state.permanentLockout ? 'Permanent account lockout' : 'Account lockout triggered',
    description: `${user.email} was locked after repeated failed authentication attempts.`,
    severity: state.permanentLockout ? 'critical' : 'warning',
    triggeredBy: user.email,
    metadata: { userId: user.id, role: user.role, lockoutCount: state.lockoutCount },
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

/** Owns authentication telemetry, account lockouts, and security alert workflows. */
@Injectable()
export class SecurityOperationsService {
  private readonly logger = new Logger(SecurityOperationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(ACCOUNT_CONTACT_READ_MODEL) private readonly accountContacts?: AccountContactReadModel,
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

  async listSecurityAlerts() {
    const alerts = await this.prisma.opsSecurityAlert.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return alerts.map((alert: OpsSecurityAlert) => this.mapSecurityAlert(alert));
  }

  async recordAuthenticationAudit(input: AuditLogInput) {
    const { eventId, actor, action, ...options } = input;
    try {
      return await this.auditService.audit(eventId, actor, action, options);
    } catch (error) {
      if (!(error instanceof AuditIntegrityConflictException)) throw error;

      const reason = await this.recordAuthenticationIntegrityIncident(input, error);
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

  async handleFailedLogin(user: OpsUser, state: AuthenticationFailureDetails) {
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
      metadata: {
        failedAttempt: state.failedAttempt,
        lockoutCount: state.lockoutCount,
        failureReason: state.failureReason,
      },
    });

    if (state.lockoutTriggered) {
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
      options.authentication
        ? this.recordAuthenticationAudit(auditWrite)
        : this.auditService.audit(input.eventId, 'System', input.title, auditOptions),
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

  /** Persist chain-failure evidence without relying on another hash-chain append. */
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
    if (!this.accountContacts) throw new ServiceUnavailableException('Account contact read model is unavailable');
    const email = (await this.accountContacts.findApprovedEmailByRole(OpsUserRole.PmcmAdmin))?.trim().toLowerCase();
    return email && email.includes('@') ? email : null;
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
