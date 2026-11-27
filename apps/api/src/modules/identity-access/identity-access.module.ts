import { Module } from '@nestjs/common';
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
import { OwnSessionsService } from './application/auth/own-sessions.service';
import { OwnTwoFactorService } from './application/auth/own-two-factor.service';
import { EmailChangeService } from './application/auth/email-change.service';
import { EmailChangeMailAdapter } from './infrastructure/auth/email-change-mail.adapter';
import { ACCOUNT_EMAIL_CHANGE_CLAIM, EMAIL_CHANGE_DELIVERY } from './contracts/email-change.port';
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
import { ACCOUNT_PASSWORD_CONFIRMATION } from './contracts/account-password-confirmation.port';
import { PASSWORD_RESET_DELIVERY } from './contracts/password-reset-delivery.port';
import { PasswordResetMailAdapter } from './infrastructure/auth/password-reset-mail.adapter';
import { EmailSignInCodeMailAdapter } from './infrastructure/auth/email-sign-in-code-mail.adapter';
import { EMAIL_SIGN_IN_CODE_DELIVERY } from './contracts/email-sign-in-code-delivery.port';
import { EmailSignInService } from './application/auth/email-sign-in.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, PlatformOpsModule, EventLifecycleModule, EventSessionModule, ParticipantFactsModule, MailModule, PortalUrlsModule, AccountInvitationReferenceModule],
  controllers: [OpsAuthController],
  providers: [
    AuthOperationsService,
    OwnSessionsService,
    OwnTwoFactorService,
    EmailChangeService,
    PasswordResetService,
    EmailSignInService,
    AccountActivationService,
    TotpService,
    AuthAuditAdapter,
    ParticipantReaderService,
    IdentityPrivacyRedactorService,
    { provide: AUTH_AUDIT, useExisting: AuthAuditAdapter },
    { provide: PASSWORD_RESET_DELIVERY, useClass: PasswordResetMailAdapter },
    { provide: EMAIL_SIGN_IN_CODE_DELIVERY, useClass: EmailSignInCodeMailAdapter },
    { provide: EMAIL_CHANGE_DELIVERY, useClass: EmailChangeMailAdapter },
    { provide: ACCOUNT_EMAIL_CHANGE_CLAIM, useExisting: EmailChangeService },
    { provide: PARTICIPANT_READER, useExisting: ParticipantReaderService },
    { provide: IDENTITY_PRIVACY_REDACTOR, useExisting: IdentityPrivacyRedactorService },
    { provide: ACCOUNT_PASSWORD_CONFIRMATION, useExisting: AuthOperationsService },
  ],
  exports: [AuthOperationsService, PARTICIPANT_READER, IDENTITY_PRIVACY_REDACTOR, ACCOUNT_PASSWORD_CONFIRMATION, ACCOUNT_EMAIL_CHANGE_CLAIM],
})
export class IdentityAccessModule {}
