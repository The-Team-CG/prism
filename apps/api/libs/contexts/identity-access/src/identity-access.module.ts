import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventSessionModule } from '@prism/modules/event-session';
import { EventLifecycleModule } from '@prism/contexts/event-lifecycle';
import { PlatformOpsModule } from '@prism/contexts/platform-ops';
import { OpsAuthController } from './api/auth/auth.controller';
import { AuthOperationsService } from './application/auth/auth-operations.service';
import { TotpService } from './application/auth/totp.service';

/**
 * Identity-access bounded-context composition root for user accounts,
 * approval workflow, password authentication, and two-factor enrollment.
 * Event-session remains a kernel primitive and is imported directly by
 * contexts that need verified request actors.
 *
 * Owned tables: OpsApprovalRequest (account approval workflow) and OpsUser.
 * Read-only: none.
 */
@Module({
  imports: [DatabaseModule, PlatformOpsModule, EventLifecycleModule, EventSessionModule],
  controllers: [OpsAuthController],
  providers: [AuthOperationsService, TotpService],
  exports: [AuthOperationsService],
})
export class IdentityAccessModule {}
