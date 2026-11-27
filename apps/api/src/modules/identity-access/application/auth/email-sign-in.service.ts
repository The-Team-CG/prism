import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { EMAIL_SIGN_IN_CODE_MAX_ATTEMPTS, EMAIL_SIGN_IN_CODE_TTL_MINUTES } from '@prism/types';
import { PrismaService } from '../../../../kernel/database';
import type { AuditWriteInput } from '../../../../kernel/access-control';
import { AccountApprovalStatus, AuditCategory, OpsUserRole } from '../../../../kernel/event-core';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';
import { EMAIL_SIGN_IN_CODE_DELIVERY, type EmailSignInCodeDeliveryPort } from '../../contracts/email-sign-in-code-delivery.port';
import { canonicalAccountEmail } from './account-email';
import { AuthOperationsService } from './auth-operations.service';

const GENERIC_MESSAGE = 'If that email can sign in with a code, the code is on its way.';
const WRONG_CODE = 'That code is not right. Check the newest email from P.R.I.S.M.';
const NO_CODE = 'That code has expired or was already used. Ask for a new one.';
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

/** Only clients and suppliers sign in by email code; PMCM staff keep a password and authenticator. */
const CODE_SIGN_IN_PORTALS: Partial<Record<string, string>> = { [OpsUserRole.Client]: 'client portal', [OpsUserRole.Supplier]: 'supplier portal' };

/** The hash binds the code to its account, so the same six digits issued to two people never match each other. */
export function emailSignInCodeHash(userId: string, code: string) {
  return createHash('sha256').update(`${userId}\n${code}`, 'utf8').digest('hex');
}

function sameHash(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Sign-in redesign, step 2: clients and suppliers sign in with a six-digit code emailed to them instead of a password.
 * An invited account that has never set a password is activated by its first code, since the code proves the email
 * PMCM invited. Requests answer the same whether or not the email exists, and are rate limited per email and address.
 */
@Injectable()
export class EmailSignInService {
  private readonly logger = new Logger(EmailSignInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authOperations: AuthOperationsService,
    @Inject(EMAIL_SIGN_IN_CODE_DELIVERY) private readonly delivery: EmailSignInCodeDeliveryPort,
    @Optional() @Inject(AUTH_AUDIT) private readonly authAudit?: Pick<AuthAuditPort, 'write'>,
  ) {}

  async request(email: string, clientIp: string, now = new Date()) {
    const normalizedEmail = canonicalAccountEmail(email);
    const rateLimited = await this.consumeRateLimit(normalizedEmail, clientIp, now);
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });
    const portalName = user ? CODE_SIGN_IN_PORTALS[user.role] : undefined;
    const eligible = Boolean(user && portalName && !user.permanentLockout
      && (user.approvalStatus === AccountApprovalStatus.Approved || user.approvalStatus === AccountApprovalStatus.Invited));
    await this.recordAudit(user?.name ?? 'Unknown user', `Sign-in code requested for ${normalizedEmail}`, {
      actorRole: user?.role ?? OpsUserRole.Unknown,
      actorEmail: normalizedEmail,
      actionType: 'email_sign_in_code_requested',
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: user?.id,
      affectedLabel: normalizedEmail,
      severity: 'info',
      metadata: { clientIp, rateLimited, eligible },
    });
    if (rateLimited || !eligible || !user || !portalName) return { message: GENERIC_MESSAGE };

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.prisma.$transaction(async (tx) => {
      // A newer code replaces the open one, so only the latest email works.
      await tx.opsEmailSignInCode.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
      await tx.opsEmailSignInCode.create({ data: {
        id: `esc_${randomUUID()}`, userId: user.id, codeHash: emailSignInCodeHash(user.id, code),
        expiresAt: new Date(now.getTime() + EMAIL_SIGN_IN_CODE_TTL_MINUTES * 60_000), createdAt: now,
      } });
    });
    // Not awaited: a provider round-trip would make known accounts answer more slowly than unknown ones.
    void this.deliverCode(user.id, user.email, code, portalName);
    return { message: GENERIC_MESSAGE };
  }

  async verify(email: string, code: string, device?: string, now = new Date()) {
    const normalizedEmail = canonicalAccountEmail(email);
    const user = await this.prisma.opsUser.findUnique({ where: { email: normalizedEmail } });
    const open = user ? await this.prisma.opsEmailSignInCode.findFirst({
      where: { userId: user.id, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    }) : null;
    if (!user || !open || !CODE_SIGN_IN_PORTALS[user.role]) throw new BadRequestException(NO_CODE);

    if (!sameHash(open.codeHash, emailSignInCodeHash(user.id, code))) {
      const attempts = open.attempts + 1;
      await this.prisma.opsEmailSignInCode.update({
        where: { id: open.id },
        data: { attempts, ...(attempts >= EMAIL_SIGN_IN_CODE_MAX_ATTEMPTS ? { consumedAt: now } : {}) },
      });
      await this.recordAudit(user.name, `Wrong sign-in code for ${normalizedEmail}`, {
        actorRole: user.role, actorEmail: normalizedEmail, actionType: 'email_sign_in_code_failed', category: AuditCategory.Access,
        affectedType: 'account', affectedId: user.id, affectedLabel: normalizedEmail, severity: 'warning', metadata: { attempts },
      });
      if (attempts >= EMAIL_SIGN_IN_CODE_MAX_ATTEMPTS) throw new BadRequestException('Too many wrong tries. Ask for a new code.');
      const left = EMAIL_SIGN_IN_CODE_MAX_ATTEMPTS - attempts;
      throw new BadRequestException(`${WRONG_CODE} ${left} ${left === 1 ? 'try' : 'tries'} left.`);
    }

    const consumed = await this.prisma.opsEmailSignInCode.updateMany({ where: { id: open.id, consumedAt: null }, data: { consumedAt: now } });
    if (consumed.count !== 1) throw new BadRequestException(NO_CODE);
    if (user.approvalStatus === AccountApprovalStatus.Invited) await this.activateInvitedAccount(user.id, now);
    return this.authOperations.signInWithVerifiedEmail(user.id, device);
  }

  /** The code proves the invited email, so the invitation is used up and the account is approved, without a password. */
  private async activateInvitedAccount(userId: string, now: Date) {
    await this.prisma.$transaction(async (tx) => {
      await tx.opsAccountInvitation.updateMany({ where: { userId, consumedAt: null, revokedAt: null }, data: { consumedAt: now } });
      await tx.opsUser.updateMany({
        where: { id: userId, approvalStatus: AccountApprovalStatus.Invited },
        data: { approvalStatus: AccountApprovalStatus.Approved, sessionVersion: { increment: 1 }, failedLoginCount: 0, lockoutCount: 0, lockedUntil: null },
      });
    });
    await this.recordAudit('System', 'Account activated by an emailed sign-in code', {
      actorRole: OpsUserRole.System, actionType: 'account_activated', category: AuditCategory.Access,
      affectedType: 'account', affectedId: userId, severity: 'info',
    });
  }

  private async deliverCode(userId: string, recipient: string, code: string, portalName: string) {
    try {
      await this.delivery.deliver({ recipient, code, portalName });
    } catch {
      // The reason is not logged: it can carry provider detail, and the code must never reach a log.
      this.logger.warn('Sign-in code email was not delivered; the code expires unused');
      await this.recordAudit('System', 'Sign-in code delivery failed', {
        actorRole: OpsUserRole.System, actionType: 'email_sign_in_code_delivery_failed', category: AuditCategory.Access,
        affectedType: 'account', affectedId: userId, severity: 'warning',
      });
    }
  }

  /**
   * Shares the password-reset limiter table. Its rows are unique per email and address, so code requests are kept
   * under a `code:` email key and the two limits never consume each other.
   */
  private async consumeRateLimit(normalizedEmail: string, clientIp: string, now: Date) {
    const limitKey = `code:${normalizedEmail}`;
    const id = createHash('sha256').update(`${limitKey}\n${clientIp}`).digest('hex');
    const row = await this.prisma.opsPasswordResetRateLimit.upsert({
      where: { id },
      create: { id, normalizedEmail: limitKey, clientIp, windowStartedAt: now, requestCount: 1 },
      update: { requestCount: { increment: 1 } },
    });
    if (now.getTime() - row.windowStartedAt.getTime() >= RATE_LIMIT_WINDOW_MS) {
      await this.prisma.opsPasswordResetRateLimit.update({ where: { id }, data: { windowStartedAt: now, requestCount: 1 } });
      return false;
    }
    return row.requestCount > RATE_LIMIT_MAX_REQUESTS;
  }

  private async recordAudit(actor: string, action: string, options: Omit<AuditWriteInput, 'actor' | 'action'>) {
    if (!this.authAudit) return;
    try {
      await this.authAudit.write({ actor, action, ...options });
    } catch (error) {
      this.logger.warn(`Sign-in code audit could not be recorded: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
