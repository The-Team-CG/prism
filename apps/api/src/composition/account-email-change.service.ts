import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { PrismEmailChangeConfirmed } from '@prism/types';
import { PrismaService } from '@prism/kernel/database';
import type { AccountEmailRelinker } from '@prism/kernel/shared-kernel';
import { ACCOUNT_EMAIL_CHANGE_CLAIM, type AccountEmailChangeClaim } from '@prism/contexts/identity-access';
import { LIFECYCLE_ACCOUNT_EMAIL_RELINKER } from '@prism/contexts/event-lifecycle';
import { COMMERCIAL_ACCOUNT_EMAIL_RELINKER } from '@prism/contexts/commercial';
import { OPERATIONS_ACCOUNT_EMAIL_RELINKER } from '@prism/contexts/operations';
import { PLATFORM_ACCOUNT_EMAIL_RELINKER } from '@prism/contexts/platform-ops';

/**
 * Opening the link sent to a new sign-in email. In one transaction the account switches address (every session ends)
 * and each context moves its own copy of the address, so a client keeps their events, a supplier their record, and
 * notifications go to the new address. Any failure leaves everything at the old address.
 */
@Injectable()
export class AccountEmailChangeService {
  private readonly relinkers: AccountEmailRelinker[];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACCOUNT_EMAIL_CHANGE_CLAIM) private readonly identity: AccountEmailChangeClaim,
    @Inject(LIFECYCLE_ACCOUNT_EMAIL_RELINKER) lifecycle: AccountEmailRelinker,
    @Inject(COMMERCIAL_ACCOUNT_EMAIL_RELINKER) commercial: AccountEmailRelinker,
    @Inject(OPERATIONS_ACCOUNT_EMAIL_RELINKER) operations: AccountEmailRelinker,
    @Inject(PLATFORM_ACCOUNT_EMAIL_RELINKER) platform: AccountEmailRelinker,
  ) {
    this.relinkers = [lifecycle, commercial, operations, platform];
  }

  async confirm(token: string): Promise<PrismEmailChangeConfirmed> {
    const claim = await this.prisma.$transaction(async (tx) => {
      const claimed = await this.identity.claim(token, tx);
      if (claimed.status === 'changed') {
        for (const relinker of this.relinkers) await relinker.relinkAccountEmail(claimed, tx);
      }
      return claimed;
    });
    // Outside the transaction, so cancelling the request for an address that is now taken is kept.
    if (claim.status === 'taken') throw new ConflictException('That email now belongs to another account, so nothing changed. Message PMCM for help.');
    return { email: claim.newEmail };
  }
}
