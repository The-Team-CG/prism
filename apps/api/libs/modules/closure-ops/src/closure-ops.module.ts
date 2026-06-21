import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FileOpsModule } from '@prism/modules/file-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { CLOSURE_COMMANDS, CLOSURE_READINESS_READER } from './ports/closure-ops.tokens';
import { EventClosureService } from './services/event-closure.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, AccessControlModule, NotificationOpsModule, FileOpsModule],
  providers: [
    EventClosureService,
    { provide: CLOSURE_COMMANDS, useExisting: EventClosureService },
    { provide: CLOSURE_READINESS_READER, useExisting: EventClosureService },
  ],
  exports: [EventClosureService, CLOSURE_COMMANDS, CLOSURE_READINESS_READER],
})
export class ClosureOpsModule {}