import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { MailModule } from '@prism/kernel/mail';
import { PortalUrlsModule } from '@prism/kernel/shared';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { ACCOUNT_INVITATION_DELIVERY, ACCOUNT_PROVISIONING } from './contracts/account-invitation.port';
import { AccountInvitationService } from './application/auth/account-invitation.service';
import { AccountInvitationMailAdapter } from './infrastructure/auth/account-invitation-mail.adapter';

/**
 * Lets other contexts provision account logins without importing the identity composition root, which
 * imports event-lifecycle. Depends only on kernel modules and platform-ops audit, so it adds no import cycle.
 */
@Module({
  imports: [DatabaseModule, PlatformOpsModule, MailModule, PortalUrlsModule],
  providers: [
    AccountInvitationService,
    { provide: ACCOUNT_INVITATION_DELIVERY, useClass: AccountInvitationMailAdapter },
    { provide: ACCOUNT_PROVISIONING, useExisting: AccountInvitationService },
  ],
  exports: [ACCOUNT_PROVISIONING, AccountInvitationService],
})
export class AccountInvitationReferenceModule {}
