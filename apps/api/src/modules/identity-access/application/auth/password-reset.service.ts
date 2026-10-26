import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../kernel/database';
import type { AuditWriteInput } from '../../../../kernel/access-control';
import { AuditCategory, OpsUserRole } from '../../../../kernel/event-core';
import { PRISM_PORTAL_URLS, type ApiLinkedPortalApp, type PrismPortalUrls } from '@prism/kernel/shared';
import { AuthSecurityService } from './auth-security.service';
import { PASSWORD_RESET_DELIVERY, PASSWORD_RESET_TTL_MS, type PasswordResetDeliveryPort } from '../../contracts/password-reset-delivery.port';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';
import { canonicalAccountEmail } from './account-email';

const GENERIC_MESSAGE = 'If an account exists for that email, password reset instructions will be sent.';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

function tokenHash(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * The portal an account signs in through, which decides where its reset link leads. Exhaustive over the
 * role constants, so a new role is a compile error here. Guests sign in with event codes and have no
 * password reset page; system and unknown accounts have no portal sign-in. Those roles receive no link.
 */
export function portalForAccountRole(role: OpsUserRole): ApiLinkedPortalApp | null {
  switch (role) {
    case OpsUserRole.Client:
      return 'client';
    case OpsUserRole.Supplier:
      return 'supplier';
    case OpsUserRole.PmcmAdmin:
    case OpsUserRole.Coordinator:
      return 'event';
    case OpsUserRole.Guest:
    case OpsUserRole.System:
    case OpsUserRole.Unknown:
      return null;
  }
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_RESET_DELIVERY) private readonly delivery: PasswordResetDeliveryPort,
    @Inject(PRISM_PORTAL_URLS) private readonly portalUrls: PrismPortalUrls,
    @Optional() @Inject(AUTH_AUDIT) private readonly authAudit?: Pick<AuthAuditPort, 'write'>,
  ) {}

  async request(email: string, clientIp: string) {
    const normalizedEmail = canonicalAccountEmail(email);
    const rateLimited = await this.consumeRateLimit(normalizedEmail, clientIp);
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });
    await this.recordAudit(
      user?.name ?? 'Unknown user',
      `Password reset requested for ${normalizedEmail}`,
      {
        actorRole: user?.role ?? OpsUserRole.Unknown,
        actorEmail: normalizedEmail,
        actionType: 'password_reset_requested',
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: user?.id,
        affectedLabel: normalizedEmail,
        severity: 'info',
        metadata: { clientIp, rateLimited },
      },
    );

    // An account without a password is activated by its invitation, not by a reset, so no link is sent for it.
    if (!rateLimited && user && user.password !== null) {
      const portal = portalForAccountRole(user.role as OpsUserRole);
      if (portal) {
        const token = randomBytes(32).toString('base64url');
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
        await this.prisma.$transaction(async (tx) => {
          await tx.opsPasswordResetToken.create({
            data: { id: `prt_${randomUUID()}`, userId: user.id, tokenHash: tokenHash(token), expiresAt },
          });
        });
        // Not awaited: a provider round-trip would make known accounts answer more slowly than unknown ones.
        void this.deliverResetLink(user.id, user.email, this.resetUrlFor(portal, token));
      }
    }
    return { message: GENERIC_MESSAGE };
  }

  async consume(token: string, password: string) {
    const hash = tokenHash(token);
    const now = new Date();
    let candidateUserId: string | undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        const candidate = await tx.opsPasswordResetToken.findUnique({ where: { tokenHash: hash } });
        if (!candidate || candidate.consumedAt || candidate.expiresAt <= now) throw new BadRequestException('Invalid or expired password reset token');
        candidateUserId = candidate.userId;

        const consumed = await tx.opsPasswordResetToken.updateMany({
          where: { id: candidate.id, consumedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw new BadRequestException('Invalid or expired password reset token');

        await tx.opsUser.update({
          where: { id: candidate.userId },
          data: {
            password: await AuthSecurityService.hashPassword(password),
            sessionVersion: { increment: 1 },
            failedLoginCount: 0,
            lockoutCount: 0,
            lockedUntil: null,
            permanentLockout: false,
            twoFactorChallengeHash: null,
            twoFactorChallengeExpiresAt: null,
            twoFactorChallengeAttempts: 0,
            twoFactorChallengeConsumedAt: null,
          },
        });
      });
    } catch (error) {
      await this.recordAudit('Unknown user', 'Password reset consumption failed', {
        actorRole: OpsUserRole.Unknown,
        actionType: 'password_reset_consumption_failed',
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: candidateUserId,
        severity: 'warning',
        metadata: { tokenProvided: true, reason: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
    await this.recordAudit('System', 'Password reset consumed', {
      actorRole: OpsUserRole.System,
      actionType: 'password_reset_consumed',
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: candidateUserId,
      severity: 'warning',
    });
    return { message: 'Password reset completed. Please sign in again.' };
  }

  private resetUrlFor(portal: ApiLinkedPortalApp, token: string) {
    const link = new URL(`${this.portalUrls[portal]}/password-reset`);
    link.searchParams.set('token', token);
    return link.toString();
  }

  private async deliverResetLink(userId: string, recipient: string, resetUrl: string) {
    try {
      await this.delivery.deliver({ recipient, resetUrl });
    } catch {
      // The reason is deliberately not logged: it can carry provider detail, and the URL must never reach a log.
      this.logger.warn('Password reset email was not delivered; the link expires unused');
      await this.recordAudit('System', 'Password reset delivery failed', {
        actorRole: OpsUserRole.System,
        actionType: 'password_reset_delivery_failed',
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: userId,
        severity: 'warning',
      });
    }
  }

  private async consumeRateLimit(normalizedEmail: string, clientIp: string) {
    const now = new Date();
    const id = createHash('sha256').update(`${normalizedEmail}\n${clientIp}`).digest('hex');
    const row = await this.prisma.opsPasswordResetRateLimit.upsert({
      where: { id },
      create: { id, normalizedEmail, clientIp, windowStartedAt: now, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
    });
    if (now.getTime() - row.windowStartedAt.getTime() >= RATE_LIMIT_WINDOW_MS) {
      await this.prisma.opsPasswordResetRateLimit.update({
        where: { id },
        data: { windowStartedAt: now, requestCount: 1 },
      });
      return false;
    }
    return row.requestCount > RATE_LIMIT_MAX_REQUESTS;
  }

  private async recordAudit(actor: string, action: string, options: Omit<AuditWriteInput, 'actor' | 'action'>) {
    if (!this.authAudit) return;
    try {
      await this.authAudit.write({ actor, action, ...options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Password reset audit could not be recorded: ${message}`);
    }
  }
}
