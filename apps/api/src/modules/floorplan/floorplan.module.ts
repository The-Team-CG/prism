import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/kernel/database';
import { AccessControlModule } from '@prism/kernel/access-control';
import { EventCoreModule } from '@prism/kernel/event-core';
import { EventSessionModule } from '@prism/kernel/event-session';
import { ClientFloorplanAccessModule, EventLifecycleProjectionModule } from '@prism/contexts/event-lifecycle';
import { FloorplanReferenceModule } from '@prism/contexts/event-lifecycle/floorplan-reference';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { OpsEventFloorplansController } from './api/live/event-floorplans.controller';
import { LayoutEventsController } from './api/authoring/layout-events.controller';
import { PlansController } from './api/authoring/plans.controller';
import { PublishController } from './api/authoring/publish.controller';
import { TemplatesController } from './api/authoring/templates.controller';
import { FLOORPLAN_COMMANDS, FLOORPLAN_READER } from './contracts/floorplan.tokens';
import { FloorPlanWorkflowService } from './application/live/floor-plan-workflow.service';
import { FloorplanClientReviewController } from './api/live/floorplan-client-review.controller';
import { FloorPlanClientReviewService } from './application/live/floorplan-client-review.service';
import { LayoutEventsService } from './application/authoring/layout-events.service';
import { PlansService } from './application/authoring/plans.service';
import { PublishService } from './application/authoring/publish.service';
import { TemplatesService } from './application/authoring/templates.service';

@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, PlatformOpsModule, EventSessionModule, EventLifecycleProjectionModule, FloorplanReferenceModule, ClientFloorplanAccessModule],
  controllers: [OpsEventFloorplansController, FloorplanClientReviewController, LayoutEventsController, PlansController, PublishController, TemplatesController],
  providers: [
    FloorPlanWorkflowService,
    FloorPlanClientReviewService,
    LayoutEventsService,
    PlansService,
    PublishService,
    TemplatesService,
    { provide: FLOORPLAN_COMMANDS, useExisting: FloorPlanWorkflowService },
    { provide: FLOORPLAN_READER, useExisting: FloorPlanWorkflowService },
  ],
  exports: [FloorPlanWorkflowService, FLOORPLAN_COMMANDS, FLOORPLAN_READER],
})
export class FloorplanModule {}
