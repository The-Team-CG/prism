import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PrismPendingEmailChange, PrismVerifiedEventActor, RequestEmailChangeInput } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { writeAudit } from '@prism/kernel/access-control';
import { PRISM_PORTAL_URLS, type PrismPortalUrls } from '@prism/kernel/shared';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';
import { ACCOUNT_PASSWORD_CONFIRMATION, type AccountPasswordConfirmation } from '../../contracts/account-password-confirmation.port';
import {
  EMAIL_CHANGE_DELIVERY,
  EMAIL_CHANGE_TTL_MS,
  type AccountEmailChangeClaim,
  type EmailChangeClaim,
  type EmailChangeDeliveryPort,
} from '../../contracts/email-change.port';
import { canonicalAccountEmail } from './account-email';
import { portalForAccountRole } from './password-reset.service';

const SESSION_REVOKED = 'Session has been revoked or account access is no longer eligible';
const INVALID_LINK = 'This link has expired or was already used. Ask for a new one from your account page.';
/** Requests one person may make in a day, so the confirmation email cannot be used to spam an address. */
const DAILY_REQUEST_LIMIT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

const tokenHash = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex');

/**
 * Changing one's own sign-in email. The password starts it; a link goes to the new address and a notice to the
 * current one; the account switches only when the link is opened (see AccountEmailChangeService in composition,
 * which also moves every other context's copy of the address in the same transaction).
 */
@Injectable()
export class EmailChangeService implements AccountEmailChangeClaim {
  private readonly logger = new Logger(EmailChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_AUDIT) private readonly authAudit: AuthAuditPort,
    @Inject(ACCOUNT_PASSWORD_CONFIRMATION) private readonly passwords: AccountPasswordConfirmation,
    @Inject(EMAIL_CHANGE_DELIVERY) private readonly delivery: EmailChangeDeliveryPort,
    @Inject(PRISM_PORTAL_URLS) private readonly portalUrls: PrismPortalUrls,
  ) {}

  async request(actor: PrismVerifiedEventActor, input: RequestEmailChangeInput): Promise<PrismPendingEmailChange> {
    await this.passwords.confirmPassword(actor.id, input.password);
    const user = await this.prisma.opsUser.findUnique({ where: { id: actor.id }, select: { email: true, name: true, role: true } });
    if (!user) throw new UnauthorizedException(SESSION_REVOKED);
    const newEmail = canonicalAccountEmail(input.newEmail);
    if (newEmail === user.email) throw new BadRequestException('That is already your sign-in email.');
    const portal = portalForAccountRole(user.role as OpsUserRole);
    if (!portal) throw new BadRequestException('This account signs in without an email.');
    const now = new Date();
    const recent = await this.prisma.opsEmailChangeRequest.count({ where: { userId: actor.id, createdAt: { gt: new Date(now.getTime() - DAY_MS) } } });
    if (recent >= DAILY_REQUEST_LIMIT) throw new HttpException('You asked for several email changes today. Try again tomorrow.', HttpStatus.TOO_MANY_REQUESTS);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + EMAIL_CHANGE_TTL_MS);
    await this.prisma.$transaction(async (tx) => {
      await tx.opsEmailChangeRequest.updateMany({ where: this.openWhere(actor.id, now), data: { cancelledAt: now } });
      await tx.opsEmailChangeRequest.create({ data: { id: `ecr_${randomUUID()}`, userId: actor.id, newEmail, tokenHash: tokenHash(token), expiresAt } });
      await this.audit(tx, actor, 'Asked to change their sign-in email', { newEmail });
    });

    const link = new URL(`${this.portalUrls[portal]}/confirm-email`);
    link.searchParams.set('token', token);
    try {
      await this.delivery.sendConfirmation({ recipient: newEmail, name: user.name, confirmUrl: link.toString() });
    } catch {
      throw new ServiceUnavailableException('We could not send the email to that address. Check it and try again.');
    }
    // Best effort: the change still waits for the new address, so a failed notice never blocks it.
    void this.delivery.sendNotice({ recipient: user.email, name: user.name, newEmail }).catch(() => this.logger.warn('Email change notice was not delivered'));
    return { email: newEmail, expiresAt: expiresAt.toISOString() };
  }

  /** Withdraws the open request, so its link stops working. */
  async cancel(actor: PrismVerifiedEventActor): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.opsEmailChangeRequest.updateMany({ where: this.openWhere(actor.id, now), data: { cancelledAt: now } });
      if (cancelled.count > 0) await this.audit(tx, actor, 'Withdrew their sign-in email change', {});
    });
  }

  /** The open request, for the account page. */
  async pending(userId: string): Promise<PrismPendingEmailChange | null> {
    const open = await this.prisma.opsEmailChangeRequest.findFirst({
      where: this.openWhere(userId, new Date()),
      orderBy: { createdAt: 'desc' },
      select: { newEmail: true, expiresAt: true },
    });
    return open ? { email: open.newEmail, expiresAt: open.expiresAt.toISOString() } : null;
  }

  async claim(token: string, tx: Prisma.TransactionClient): Promise<EmailChangeClaim> {
    const now = new Date();
    const request = await tx.opsEmailChangeRequest.findUnique({ where: { tokenHash: tokenHash(token) } });
    if (!request || request.consumedAt || request.cancelledAt || request.expiresAt <= now) throw new BadRequestException(INVALID_LINK);
    const user = await tx.opsUser.findUnique({ where: { id: request.userId } });
    if (!user) throw new BadRequestException(INVALID_LINK);
    const taken = await tx.opsUser.findUnique({ where: { email: request.newEmail }, select: { id: true } });
    if (taken) {
      await tx.opsEmailChangeRequest.update({ where: { id: request.id }, data: { cancelledAt: now } });
      return { status: 'taken' };
    }
    const used = await tx.opsEmailChangeRequest.updateMany({ where: { id: request.id, consumedAt: null, cancelledAt: null }, data: { consumedAt: now } });
    if (used.count !== 1) throw new BadRequestException(INVALID_LINK);
    // Sessions carry the email, so every one ends; the person signs in again with the new address.
    await tx.opsUser.update({ where: { id: user.id }, data: { email: request.newEmail, sessionVersion: { increment: 1 } } });
    await tx.opsApprovalRequest.updateMany({ where: { userId: user.id }, data: { email: request.newEmail } });
    await writeAudit(this.authAudit, undefined, user.name, 'Changed their sign-in email and signed out every session', {
      actorRole: user.role,
      actorEmail: request.newEmail,
      actionType: AuditActionType.Update,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: user.id,
      affectedLabel: request.newEmail,
      metadata: { previousEmail: user.email, newEmail: request.newEmail },
    }, { prisma: tx, correlationId: user.id, actorId: user.id });
    return { status: 'changed', userId: user.id, role: user.role, previousEmail: user.email, newEmail: request.newEmail };
  }

  private openWhere(userId: string, now: Date): Prisma.OpsEmailChangeRequestWhereInput {
    return { userId, consumedAt: null, cancelledAt: null, expiresAt: { gt: now } };
  }

  private audit(tx: Prisma.TransactionClient, actor: PrismVerifiedEventActor, action: string, metadata: Record<string, unknown>) {
    return writeAudit(this.authAudit, undefined, actor.name, action, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: actor.id,
      affectedLabel: actor.email,
      metadata,
    }, { prisma: tx, correlationId: actor.id, actorId: actor.id });
  }
}
