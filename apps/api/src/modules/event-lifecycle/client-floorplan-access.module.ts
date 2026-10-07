import { Module } from '@nestjs/common';
import { AccessControlModule } from '@prism/kernel/access-control';
import { DatabaseModule } from '@prism/kernel/database';
import { AccountContactReadModelModule } from '@prism/contexts/read-models/account-contacts';
import { EventClientFloorplanAccessService } from './application/client-visibility/event-client-floorplan-access.service';
import {
  EVENT_CLIENT_FLOORPLAN_ACCESS_COMMANDS,
  EVENT_CLIENT_FLOORPLAN_ACCESS_READER,
} from './contracts/client-floorplan-access.port';

/**
 * Narrow Lifecycle-owned grant capability shared by Floorplan and ReadModels.
 * AUDIT_WRITER comes from the root's global PlatformOpsAuditWriterModule.
 */
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    AccountContactReadModelModule,
  ],
  providers: [
    EventClientFloorplanAccessService,
    { provide: EVENT_CLIENT_FLOORPLAN_ACCESS_COMMANDS, useExisting: EventClientFloorplanAccessService },
    { provide: EVENT_CLIENT_FLOORPLAN_ACCESS_READER, useExisting: EventClientFloorplanAccessService },
  ],
  exports: [EVENT_CLIENT_FLOORPLAN_ACCESS_COMMANDS, EVENT_CLIENT_FLOORPLAN_ACCESS_READER],
})
export class ClientFloorplanAccessModule {}
