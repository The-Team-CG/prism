import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismPrivacyExportSection } from '@prism/types';
import { randomUUID } from 'node:crypto';
import type { IdentityPrivacyRedactor } from '../../contracts/privacy-redaction.port';
import { canonicalAccountEmail } from '../auth/account-email';

@Injectable()
export class IdentityPrivacyRedactorService implements IdentityPrivacyRedactor {
  findNativeAccount(email: string, transaction: Prisma.TransactionClient) {
    return transaction.opsUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, role: true },
    });
  }

  redactApprovalIdentity(
    input: { email: string; redactedEmail: string; role: string },
    transaction: Prisma.TransactionClient,
  ) {
    return transaction.opsApprovalRequest.updateMany({
      where: { email: { equals: input.email, mode: 'insensitive' }, role: input.role },
      data: { name: 'Redacted data subject', email: canonicalAccountEmail(input.redactedEmail), organization: '' },
    });
  }

  /**
   * Erases a native account in place so audit actor references stay valid. The password becomes an unguessable
   * value, 2FA and reset state are cleared, the account is locked, and existing sessions are revoked.
   */
  async eraseAccount(input: { accountId: string; email: string; redactedEmail: string }, transaction: Prisma.TransactionClient) {
    const erased = await transaction.opsUser.updateMany({
      where: { id: input.accountId, email: { equals: input.email, mode: 'insensitive' } },
      data: {
        name: 'Redacted account',
        email: canonicalAccountEmail(input.redactedEmail),
        organization: '',
        password: `erased:${randomUUID()}`,
        permanentLockout: true,
        lockedUntil: null,
        twoFactorSecret: null,
        twoFactorChallengeHash: null,
        twoFactorChallengeExpiresAt: null,
        twoFactorChallengeAttempts: 0,
        twoFactorChallengeConsumedAt: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (erased.count === 1) {
      await transaction.opsPasswordResetToken.deleteMany({ where: { userId: input.accountId } });
    }
    return erased;
  }

  async exportAccount(email: string, transaction: Prisma.TransactionClient): Promise<PrismPrivacyExportSection[]> {
    const accounts = await transaction.opsUser.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { name: true, email: true, role: true, organization: true, approvalStatus: true, createdAt: true, lastLoginAt: true },
    });
    const approvals = await transaction.opsApprovalRequest.findMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: {
        name: true, email: true, role: true, organization: true, status: true,
        privacyConsentAccepted: true, privacyNoticeVersion: true, marketingConsentAccepted: true, requestedAt: true,
      },
    });
    const sections: PrismPrivacyExportSection[] = [
      {
        owner: 'identity-access',
        surface: 'account',
        records: accounts.map((account) => ({
          name: account.name,
          email: account.email,
          role: account.role,
          organization: account.organization,
          approvalStatus: account.approvalStatus,
          createdAt: account.createdAt.toISOString(),
          lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
        })),
      },
      {
        owner: 'identity-access',
        surface: 'approval_request',
        records: approvals.map((approval) => ({
          name: approval.name,
          email: approval.email,
          role: approval.role,
          organization: approval.organization,
          status: approval.status,
          privacyConsentAccepted: approval.privacyConsentAccepted,
          privacyNoticeVersion: approval.privacyNoticeVersion,
          marketingConsentAccepted: approval.marketingConsentAccepted,
          requestedAt: approval.requestedAt.toISOString(),
        })),
      },
    ];
    return sections.filter((section) => section.records.length > 0);
  }
}
