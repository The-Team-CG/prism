import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsCoordinatorsController } from './controllers/coordinators.controller';
import { STAFFING_COMMANDS, STAFFING_READER } from './ports/staffing-ops.tokens';
import { CoordinatorsService } from './services/coordinators.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, NotificationOpsModule],
  controllers: [OpsCoordinatorsController],
  providers: [
    CoordinatorsService,
    { provide: STAFFING_COMMANDS, useExisting: CoordinatorsService },
    { provide: STAFFING_READER, useExisting: CoordinatorsService },
  ],
  exports: [CoordinatorsService, STAFFING_COMMANDS, STAFFING_READER],
})
export class StaffingOpsModule {}
