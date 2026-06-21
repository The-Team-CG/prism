import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { EventCoreModule } from '@prism/modules/event-core';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { FLOORPLAN_COMMANDS, FLOORPLAN_READER } from './ports/floorplan.tokens';
import { FloorPlanWorkflowService } from './services/floor-plan-workflow.service';

@Module({
  imports: [DatabaseModule, EventCoreModule, TrustOpsModule, NotificationOpsModule],
  providers: [
    FloorPlanWorkflowService,
    { provide: FLOORPLAN_COMMANDS, useExisting: FloorPlanWorkflowService },
    { provide: FLOORPLAN_READER, useExisting: FloorPlanWorkflowService },
  ],
  exports: [FloorPlanWorkflowService, FLOORPLAN_COMMANDS, FLOORPLAN_READER],
})
export class FloorplanModule {}