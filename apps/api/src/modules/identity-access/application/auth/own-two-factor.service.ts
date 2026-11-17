import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismOwnTwoFactorSetup, PrismVerifiedEventActor } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import { AuditActionType, AuditCategory, OpsUserRole } from '@prism/kernel/event-core';
import { writeAudit } from '@prism/kernel/access-control';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';
import { ACCOUNT_PASSWORD_CONFIRMATION, type AccountPasswordConfirmation } from '../../contracts/account-password-confirmation.port';
import { TotpService } from './totp.service';

const SESSION_REVOKED = 'Session has been revoked or account access is no longer eligible';

/**
 * Two-step sign-in a person turns on or off from their own account page. PMCM admins always have it (they enrol at
 * sign-in), so they cannot turn it off. Starting and turning off need the current password; turning on needs a code
 * from the authenticator just added, so nobody is locked out by a scan that did not work.
 */
@Injectable()
export class OwnTwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_AUDIT) private readonly authAudit: AuthAuditPort,
    @Inject(ACCOUNT_PASSWORD_CONFIRMATION) private readonly passwords: AccountPasswordConfirmation,
    private readonly totp: TotpService,
  ) {}

  /** A new secret for the authenticator app. Two-step sign-in stays off until a code from it is confirmed. */
  async start(actor: PrismVerifiedEventActor, password: string): Promise<PrismOwnTwoFactorSetup> {
    await this.passwords.confirmPassword(actor.id, password);
    const user = await this.prisma.opsUser.findUnique({ where: { id: actor.id }, select: { twoFactorSecret: true, email: true } });
    if (!user) throw new UnauthorizedException(SESSION_REVOKED);
    if (user.twoFactorSecret) throw new ConflictException('Two-step sign-in is already on.');
    const secret = this.totp.generateSecret();
    const saved = await this.prisma.opsUser.updateMany({
      where: { id: actor.id, sessionVersion: actor.sessionVersion, twoFactorSecret: null },
      data: { twoFactorPendingSecret: this.totp.encryptSecret(secret) },
    });
    if (saved.count !== 1) throw new UnauthorizedException(SESSION_REVOKED);
    return { secret, otpauthUri: this.totp.otpauthUri(secret, user.email) };
  }

  /** Turns two-step sign-in on once a code from the authenticator just added matches. */
  async enable(actor: PrismVerifiedEventActor, code: string): Promise<void> {
    const user = await this.prisma.opsUser.findUnique({ where: { id: actor.id }, select: { twoFactorSecret: true, twoFactorPendingSecret: true } });
    if (!user) throw new UnauthorizedException(SESSION_REVOKED);
    if (user.twoFactorSecret) throw new ConflictException('Two-step sign-in is already on.');
    if (!user.twoFactorPendingSecret) throw new BadRequestException('Start again: add the account to your app first.');
    if (!this.totp.verifyCode(this.totp.decryptSecret(user.twoFactorPendingSecret), code)) {
      // 403, not 401: a 401 would sign the person out over a mistyped code.
      throw new ForbiddenException('That code is not right. Enter the newest code your app shows.');
    }
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.opsUser.updateMany({
        where: { id: actor.id, sessionVersion: actor.sessionVersion, twoFactorSecret: null, twoFactorPendingSecret: user.twoFactorPendingSecret },
        data: { twoFactorSecret: user.twoFactorPendingSecret, twoFactorPendingSecret: null },
      });
      if (saved.count !== 1) throw new ConflictException('Two-step sign-in changed meanwhile. Start again.');
      await this.audit(tx, actor, 'Turned on two-step sign-in');
    });
  }

  /** Turns two-step sign-in off with the current password. PMCM staff keep it. */
  async disable(actor: PrismVerifiedEventActor, password: string): Promise<void> {
    if (actor.role === OpsUserRole.PmcmAdmin) throw new ForbiddenException('Two-step sign-in is required for PMCM staff.');
    await this.passwords.confirmPassword(actor.id, password);
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.opsUser.updateMany({
        where: { id: actor.id, sessionVersion: actor.sessionVersion },
        data: { twoFactorSecret: null, twoFactorPendingSecret: null },
      });
      if (saved.count !== 1) throw new UnauthorizedException(SESSION_REVOKED);
      await this.audit(tx, actor, 'Turned off two-step sign-in');
    });
  }

  private audit(tx: Prisma.TransactionClient, actor: PrismVerifiedEventActor, action: string) {
    return writeAudit(this.authAudit, undefined, actor.name, action, {
      actorRole: actor.role,
      actorEmail: actor.email,
      actionType: AuditActionType.Update,
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: actor.id,
      affectedLabel: actor.email,
    }, { prisma: tx, correlationId: actor.id, actorId: actor.id });
  }
}
