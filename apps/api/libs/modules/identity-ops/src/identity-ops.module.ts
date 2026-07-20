import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventSessionModule } from '@prism/modules/event-session';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsAuthController } from './controllers/auth.controller';
import { AuthOperationsService } from './services/auth-operations.service';
import { TotpService } from './services/totp.service';

@Module({
  imports: [DatabaseModule, TrustOpsModule, InquiryOnboardingModule, EventSessionModule],
  controllers: [OpsAuthController],
  providers: [AuthOperationsService, TotpService],
  exports: [AuthOperationsService, EventSessionModule],
})
export class IdentityOpsModule {}