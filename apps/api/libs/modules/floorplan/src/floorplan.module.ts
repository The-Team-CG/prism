import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsEventFloorplansController } from './controllers/event-floorplans.controller';
import { FLOORPLAN_COMMANDS, FLOORPLAN_READER } from './ports/floorplan.tokens';
import { FloorPlanWorkflowService } from './services/floor-plan-workflow.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, NotificationOpsModule],
  controllers: [OpsEventFloorplansController],
  providers: [
    FloorPlanWorkflowService,
    { provide: FLOORPLAN_COMMANDS, useExisting: FloorPlanWorkflowService },
    { provide: FLOORPLAN_READER, useExisting: FloorPlanWorkflowService },
  ],
  exports: [FloorPlanWorkflowService, FLOORPLAN_COMMANDS, FLOORPLAN_READER],
})
export class FloorplanModule {}
