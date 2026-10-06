import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { IdentityPrivacyRedactor } from '../../contracts/privacy-redaction.port';
import { canonicalAccountEmail } from '../auth/account-email';

@Injectable()
export class IdentityPrivacyRedactorService implements IdentityPrivacyRedactor {
  async hasAccount(email: string, transaction: Prisma.TransactionClient): Promise<boolean> {
    const account = await transaction.opsUser.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
    return account !== null;
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
}
