import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventCoreModule } from '@prism/modules/event-core';
import { FileOpsModule } from '@prism/modules/file-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsGuestController } from './controllers/guest.controller';
import { GUEST_COMMANDS, GUEST_READER } from './ports/guest-ops.tokens';
import { GuestWorkflowService } from './services/guest-workflow.service';

/**
 * Owned tables: OpsGuestCheckIn, OpsGuestFeedback.
 * Read-only: OpsEvent (via inquiry-onboarding).
 */
@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, FileOpsModule],
  controllers: [OpsGuestController],
  providers: [
    GuestWorkflowService,
    { provide: GUEST_COMMANDS, useExisting: GuestWorkflowService },
    { provide: GUEST_READER, useExisting: GuestWorkflowService },
  ],
  exports: [GuestWorkflowService, GUEST_COMMANDS, GUEST_READER],
})
export class GuestOpsModule {}
