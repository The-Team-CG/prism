import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventSessionModule } from '@prism/kernel/event-session';
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
import { ApprovedClientAccountReaderService } from './application/accounts/approved-client-account-reader.service';
import { APPROVED_CLIENT_ACCOUNT_READER } from './contracts/approved-client-account-reader.port';
import { PasswordResetService } from './application/auth/password-reset.service';
import { IdentityPrivacyRedactorService } from './application/participants/identity-privacy-redactor.service';
import { IDENTITY_PRIVACY_REDACTOR } from './contracts/privacy-redaction.port';

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
  imports: [DatabaseModule, AccessControlModule, PlatformOpsModule, forwardRef(() => EventLifecycleModule), EventSessionModule, ParticipantFactsModule],
  controllers: [OpsAuthController],
  providers: [
    AuthOperationsService,
    PasswordResetService,
    TotpService,
    AuthAuditAdapter,
    ParticipantReaderService,
    ApprovedClientAccountReaderService,
    IdentityPrivacyRedactorService,
    { provide: AUTH_AUDIT, useExisting: AuthAuditAdapter },
    { provide: PARTICIPANT_READER, useExisting: ParticipantReaderService },
    { provide: APPROVED_CLIENT_ACCOUNT_READER, useExisting: ApprovedClientAccountReaderService },
    { provide: IDENTITY_PRIVACY_REDACTOR, useExisting: IdentityPrivacyRedactorService },
  ],
  exports: [AuthOperationsService, PARTICIPANT_READER, APPROVED_CLIENT_ACCOUNT_READER, IDENTITY_PRIVACY_REDACTOR],
})
export class IdentityAccessModule {}
