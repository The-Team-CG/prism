import { Module, forwardRef } from '@nestjs/common';
import { AccessControlModule } from '@prism/kernel/access-control';
import { DatabaseModule } from '@prism/kernel/database';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { IdentityAccessModule } from '../identity-access/identity-access.module';
import { EventClientFloorplanAccessService } from './application/client-visibility/event-client-floorplan-access.service';
import {
  EVENT_CLIENT_FLOORPLAN_ACCESS_COMMANDS,
  EVENT_CLIENT_FLOORPLAN_ACCESS_READER,
} from './contracts/client-floorplan-access.port';

/** Narrow Lifecycle-owned grant capability shared by Floorplan and ReadModels. */
@Module({
  imports: [
    DatabaseModule,
    AccessControlModule,
    PlatformOpsModule,
    forwardRef(() => IdentityAccessModule),
  ],
  providers: [
    EventClientFloorplanAccessService,
    { provide: EVENT_CLIENT_FLOORPLAN_ACCESS_COMMANDS, useExisting: EventClientFloorplanAccessService },
    { provide: EVENT_CLIENT_FLOORPLAN_ACCESS_READER, useExisting: EventClientFloorplanAccessService },
  ],
  exports: [EVENT_CLIENT_FLOORPLAN_ACCESS_COMMANDS, EVENT_CLIENT_FLOORPLAN_ACCESS_READER],
})
export class ClientFloorplanAccessModule {}
