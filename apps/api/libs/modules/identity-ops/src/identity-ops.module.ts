import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsAuthController } from './controllers/auth.controller';
import { AuthOperationsService } from './services/auth-operations.service';
import { AuthSessionService } from './services/auth-session.service';
import { EventSessionGuard } from './guards/event-session.guard';

@Module({
  imports: [DatabaseModule, TrustOpsModule, InquiryOnboardingModule],
  controllers: [OpsAuthController],
  providers: [AuthOperationsService, AuthSessionService, EventSessionGuard],
  exports: [AuthOperationsService, AuthSessionService, EventSessionGuard],
})
export class IdentityOpsModule {}