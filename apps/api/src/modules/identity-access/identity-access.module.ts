import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventSessionModule } from '@prism/kernel/event-session';
import { MailModule } from '@prism/kernel/mail';
import { PortalUrlsModule } from '@prism/kernel/shared';
import { EventLifecycleModule } from '../event-lifecycle/event-lifecycle.module';
import { ParticipantFactsModule } from '@prism/contexts/read-models/participant-facts';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { OpsAuthController } from './api/auth/auth.controller';
import { AuthOperationsService } from './application/auth/auth-operations.service';
import { TotpService } from './application/auth/totp.service';
import { AUTH_AUDIT } from './contracts/auth-audit.port';
import { AuthAuditAdapter } from './infrastructure/auth/auth-audit.adapter';
import { ParticipantReaderService } from './application/participants/participant-reader.service';
import { PARTICIPANT_READER } from './contracts/participant-reader.port';
import { PasswordResetService } from './application/auth/password-reset.service';
import { AccountActivationService } from './application/auth/account-activation.service';
import { AccountInvitationReferenceModule } from './account-invitation-reference.module';
import { IdentityPrivacyRedactorService } from './application/participants/identity-privacy-redactor.service';
import { IDENTITY_PRIVACY_REDACTOR } from './contracts/privacy-redaction.port';
import { PASSWORD_RESET_DELIVERY } from './contracts/password-reset-delivery.port';
import { PasswordResetMailAdapter } from './infrastructure/auth/password-reset-mail.adapter';

/**
 * Identity-access bounded-context composition root for user accounts,
 * approval workflow, password authentication, and two-factor enrollment.
 * Event-session remains a kernel primitive and is imported directly by
 * contexts that need verified request actors.
 *
 * Owned tables: OpsApprovalRequest (account approval workflow) and OpsUser.
 * Read-only: participant eligibility uses the focused ReadModels participant-facts contract.
 */
@Module({
  imports: [DatabaseModule, AccessControlModule, PlatformOpsModule, forwardRef(() => EventLifecycleModule), EventSessionModule, ParticipantFactsModule, MailModule, PortalUrlsModule, AccountInvitationReferenceModule],
  controllers: [OpsAuthController],
  providers: [
    AuthOperationsService,
    PasswordResetService,
    AccountActivationService,
    TotpService,
    AuthAuditAdapter,
    ParticipantReaderService,
    IdentityPrivacyRedactorService,
    { provide: AUTH_AUDIT, useExisting: AuthAuditAdapter },
    { provide: PASSWORD_RESET_DELIVERY, useClass: PasswordResetMailAdapter },
    { provide: PARTICIPANT_READER, useExisting: ParticipantReaderService },
    { provide: IDENTITY_PRIVACY_REDACTOR, useExisting: IdentityPrivacyRedactorService },
  ],
  exports: [AuthOperationsService, PARTICIPANT_READER, IDENTITY_PRIVACY_REDACTOR],
})
export class IdentityAccessModule {}
