import { Module } from '@nestjs/common';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { EVENT_ACCESS_POLICY } from './ports/access-control.tokens';
import { EventAccessPolicyService } from './services/event-access-policy.service';

const eventAccessPolicyProvider = {
  provide: EVENT_ACCESS_POLICY,
  useExisting: EventAccessPolicyService,
};

/**
 * Owned tables: none.
 * Read-only: none.
 */
@Module({
  imports: [TrustOpsModule],
  providers: [EventAccessPolicyService, eventAccessPolicyProvider],
  exports: [EventAccessPolicyService, eventAccessPolicyProvider],
})
export class AccessControlModule {}
