import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../kernel/database';
import type { AuditWriteInput } from '../../../../kernel/access-control';
import { AuditCategory, OpsUserRole } from '../../../../kernel/event-core';
import { AuthSecurityService } from './auth-security.service';
import { PASSWORD_RESET_DELIVERY, type PasswordResetDeliveryPort } from '../../contracts/password-reset-delivery.port';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';
import { canonicalAccountEmail } from './account-email';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const GENERIC_MESSAGE = 'If an account exists for that email, password reset instructions will be sent.';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

function tokenHash(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(PASSWORD_RESET_DELIVERY) private readonly delivery?: PasswordResetDeliveryPort,
    @Optional() @Inject(AUTH_AUDIT) private readonly authAudit?: Pick<AuthAuditPort, 'write'>,
  ) {}

  async request(email: string, clientIp = 'unknown') {
    const normalizedEmail = canonicalAccountEmail(email);
    const deliveryAvailable = Boolean(this.delivery && this.buildTrustedResetUrl('placeholder'));
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

    if (!rateLimited && user) {
      const token = randomBytes(32).toString('base64url');
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await this.prisma.$transaction(async (tx) => {
        await tx.opsPasswordResetToken.create({
          data: { id: `prt_${randomUUID()}`, userId: user.id, tokenHash: tokenHash(token), expiresAt },
        });
      });

      const resetUrl = this.buildTrustedResetUrl(token);
      if (resetUrl && this.delivery) {
        try {
          await this.delivery.deliver({ recipient: user.email, resetUrl });
        } catch {
          this.logger.warn('Password reset provider failed; token remains un-delivered and can expire safely');
        }
      }
    }
    return { message: GENERIC_MESSAGE, deliveryAvailable };
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

  private buildTrustedResetUrl(token: string) {
    const url = this.parseTrustedResetUrl();
    if (!url) return null;
    url.searchParams.set('token', token);
    return url.toString();
  }

  private parseTrustedResetUrl() {
    const configured = process.env.PRISM_PORTAL_RESET_URL?.trim();
    if (!configured) return null;
    try {
      const url = new URL(configured);
      return this.isTrustedResetUrl(url) ? url : null;
    } catch {
      return null;
    }
  }

  private isTrustedResetUrl(url: URL) {
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === 'https:') return true;
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return url.protocol === 'http:' && loopback;
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
