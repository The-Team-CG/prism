import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { InquiryOnboardingModule } from '@prism/modules/inquiry-onboarding';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsAuthController } from './controllers/auth.controller';
import { AuthOperationsService } from './services/auth-operations.service';

@Module({
  imports: [DatabaseModule, TrustOpsModule, InquiryOnboardingModule],
  controllers: [OpsAuthController],
  providers: [AuthOperationsService],
  exports: [AuthOperationsService],
})
export class IdentityOpsModule {}