import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { OpsUser } from '@prisma/client';
import { PrismaService } from '../../../../kernel/database';
import type { AuditWriteInput } from '../../../../kernel/access-control';
import { AccountApprovalStatus, AuditCategory, OpsUserRole } from '../../../../kernel/event-core';
import type { PrismAccountActivationReceipt, PrismInvitationPreview } from '@prism/types';
import { AuthSecurityService } from './auth-security.service';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';

const INVALID_TOKEN_MESSAGE = 'Invalid or expired activation link';
/** Clients and suppliers can activate without a password; they sign in with emailed codes. */
const PASSWORDLESS_ROLES = new Set<string>([OpsUserRole.Client, OpsUserRole.Supplier]);

function tokenHash(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Turns an invitation into a usable login: the first password, the approved status and a new session epoch.
 * The token is consumed in the same transaction that sets the password, so a failed activation burns nothing.
 */
@Injectable()
export class AccountActivationService {
  private readonly logger = new Logger(AccountActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH_AUDIT) private readonly authAudit: Pick<AuthAuditPort, 'write'>,
  ) {}

  async activate(token: string, password: string): Promise<PrismAccountActivationReceipt> {
    const hash = tokenHash(token);
    const now = new Date();
    const passwordHash = await AuthSecurityService.hashPassword(password);
    let candidateUserId: string | undefined;
    let activated: OpsUser;
    try {
      activated = await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.opsAccountInvitation.findUnique({ where: { tokenHash: hash } });
        if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= now) {
          throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        }
        candidateUserId = invitation.userId;

        const consumed = await tx.opsAccountInvitation.updateMany({
          where: { id: invitation.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw new BadRequestException(INVALID_TOKEN_MESSAGE);

        // The account must still be waiting for activation. A concurrent approval or revocation makes this match nothing.
        const updated = await tx.opsUser.updateMany({
          where: { id: invitation.userId, approvalStatus: AccountApprovalStatus.Invited },
          data: {
            password: passwordHash,
            approvalStatus: AccountApprovalStatus.Approved,
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
        if (updated.count !== 1) throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        return tx.opsUser.findUniqueOrThrow({ where: { id: invitation.userId } });
      });
    } catch (error) {
      await this.recordAudit('Unknown user', 'Account activation failed', {
        actorRole: OpsUserRole.Unknown,
        actionType: 'account_activation_failed',
        category: AuditCategory.Access,
        affectedType: 'account',
        affectedId: candidateUserId,
        severity: 'warning',
      });
      throw error;
    }

    await this.recordAudit(activated.name, `Account activated for ${activated.email}`, {
      actorRole: activated.role,
      actorEmail: activated.email,
      actionType: 'account_activated',
      category: AuditCategory.Access,
      affectedType: 'account',
      affectedId: activated.id,
      affectedLabel: activated.email,
      severity: 'info',
    });
    return { message: 'Password set. Sign in to continue.' };
  }

  /** Who an open invitation is for, without using it up; an expired or used link reads as invalid. */
  async preview(token: string): Promise<PrismInvitationPreview> {
    const invitation = await this.prisma.opsAccountInvitation.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: true } });
    const now = new Date();
    if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= now || invitation.user.approvalStatus !== AccountApprovalStatus.Invited) {
      throw new BadRequestException(INVALID_TOKEN_MESSAGE);
    }
    const { user } = invitation;
    return { name: user.name, email: user.email, organization: user.organization, role: user.role, passwordRequired: !PASSWORDLESS_ROLES.has(user.role) };
  }

  /**
   * Sign-in redesign: a client or supplier opening their invitation confirms and continues, without a password. The
   * link went to their email, which is the same proof as an emailed code. Returns the account to sign in. PMCM staff
   * keep the password step, since they sign in with a password and authenticator.
   */
  async confirm(token: string): Promise<{ userId: string }> {
    const hash = tokenHash(token);
    const now = new Date();
    let candidateUserId: string | undefined;
    try {
      const userId = await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.opsAccountInvitation.findUnique({ where: { tokenHash: hash }, include: { user: true } });
        if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= now) {
          throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        }
        candidateUserId = invitation.userId;
        if (!PASSWORDLESS_ROLES.has(invitation.user.role)) throw new BadRequestException('Set a password to activate this account');
        const consumed = await tx.opsAccountInvitation.updateMany({
          where: { id: invitation.id, consumedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { consumedAt: now },
        });
        if (consumed.count !== 1) throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        const updated = await tx.opsUser.updateMany({
          where: { id: invitation.userId, approvalStatus: AccountApprovalStatus.Invited },
          data: { approvalStatus: AccountApprovalStatus.Approved, sessionVersion: { increment: 1 }, failedLoginCount: 0, lockoutCount: 0, lockedUntil: null, permanentLockout: false },
        });
        if (updated.count !== 1) throw new BadRequestException(INVALID_TOKEN_MESSAGE);
        return invitation.userId;
      });
      await this.recordAudit('System', 'Account activated from its invitation link', {
        actorRole: OpsUserRole.System, actionType: 'account_activated', category: AuditCategory.Access,
        affectedType: 'account', affectedId: userId, severity: 'info',
      });
      return { userId };
    } catch (error) {
      await this.recordAudit('Unknown user', 'Account activation failed', {
        actorRole: OpsUserRole.Unknown, actionType: 'account_activation_failed', category: AuditCategory.Access,
        affectedType: 'account', affectedId: candidateUserId, severity: 'warning',
      });
      throw error;
    }
  }

  private async recordAudit(actor: string, action: string, options: Omit<AuditWriteInput, 'actor' | 'action'>) {
    try {
      await this.authAudit.write({ actor, action, ...options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Account activation audit could not be recorded: ${message}`);
    }
  }
}
