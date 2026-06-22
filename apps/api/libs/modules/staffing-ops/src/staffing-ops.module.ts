import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { FloorplanModule } from '@prism/modules/floorplan';
import { GuestOpsModule } from '@prism/modules/guest-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsCoordinatorWorkspaceController } from './controllers/coordinator-workspace.controller';
import { OpsCoordinatorsController } from './controllers/coordinators.controller';
import { STAFFING_COMMANDS, STAFFING_READER } from './ports/staffing-ops.tokens';
import { CoordinatorWorkspaceReadService } from './services/coordinator-workspace-read.service';
import { CoordinatorsService } from './services/coordinators.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, FloorplanModule, GuestOpsModule],
  controllers: [OpsCoordinatorsController, OpsCoordinatorWorkspaceController],
  providers: [
    CoordinatorsService,
    CoordinatorWorkspaceReadService,
    { provide: STAFFING_COMMANDS, useExisting: CoordinatorsService },
    { provide: STAFFING_READER, useExisting: CoordinatorsService },
  ],
  exports: [CoordinatorsService, CoordinatorWorkspaceReadService, STAFFING_COMMANDS, STAFFING_READER],
})
export class StaffingOpsModule {}
