import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventSessionModule } from '@prism/modules/event-session';
import { EventLifecycleModule } from '@prism/contexts/event-lifecycle';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsAuthController } from './controllers/auth.controller';
import { AuthOperationsService } from './services/auth-operations.service';
import { TotpService } from './services/totp.service';

/**
 * Owned tables: OpsApprovalRequest (2FA/account approval requests; OpsApprovalRequest is also owned by trust-ops for other approval kinds), OpsUser.
 * Read-only: none.
 */
@Module({
  imports: [DatabaseModule, TrustOpsModule, EventLifecycleModule, EventSessionModule],
  controllers: [OpsAuthController],
  providers: [AuthOperationsService, TotpService],
  exports: [AuthOperationsService, EventSessionModule],
})
export class IdentityOpsModule {}
