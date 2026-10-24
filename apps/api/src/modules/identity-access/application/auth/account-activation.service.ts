import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { OpsUser } from '@prisma/client';
import { PrismaService } from '../../../../kernel/database';
import type { AuditWriteInput } from '../../../../kernel/access-control';
import { AccountApprovalStatus, AuditCategory, OpsUserRole } from '../../../../kernel/event-core';
import type { PrismAccountActivationReceipt } from '@prism/types';
import { AuthSecurityService } from './auth-security.service';
import { AUTH_AUDIT, type AuthAuditPort } from '../../contracts/auth-audit.port';
import { INQUIRY_COMMANDS } from '../../../event-lifecycle/contracts/inquiry-onboarding.tokens';
import type { InquiryCommands } from '../../../event-lifecycle/contracts/inquiry-commands.port';

const INVALID_TOKEN_MESSAGE = 'Invalid or expired activation link';

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
    @Inject(INQUIRY_COMMANDS) private readonly inquiryCommands: Pick<InquiryCommands, 'markPortalInvitationOpenedByEmail'>,
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
    if (activated.role === OpsUserRole.Client) {
      await this.inquiryCommands.markPortalInvitationOpenedByEmail(activated.email);
    }
    return { message: 'Password set. Sign in to continue.' };
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
