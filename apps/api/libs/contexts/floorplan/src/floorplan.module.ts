import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { AccessControlModule } from '@prism/modules/access-control';
import { EventCoreModule } from '@prism/modules/event-core';
import { IdentityOpsModule } from '@prism/modules/identity-ops';
import { NotificationOpsModule } from '@prism/modules/notification-ops';
import { TrustOpsModule } from '@prism/modules/trust-ops';
import { OpsEventFloorplansController } from './api/live/event-floorplans.controller';
import { LayoutEventsController } from './api/authoring/layout-events.controller';
import { PlansController } from './api/authoring/plans.controller';
import { PublishController } from './api/authoring/publish.controller';
import { TemplatesController } from './api/authoring/templates.controller';
import { FLOORPLAN_COMMANDS, FLOORPLAN_READER } from './contracts/floorplan.tokens';
import { FloorPlanWorkflowService } from './application/live/floor-plan-workflow.service';
import { LayoutEventsService } from './application/authoring/layout-events.service';
import { PlansService } from './application/authoring/plans.service';
import { PublishService } from './application/authoring/publish.service';
import { TemplatesService } from './application/authoring/templates.service';

/**
 * Bounded-context composition root for floorplan: live per-event floorplan
 * drafts/preferences/snapshots (`api/live`, `application/live`) and
 * venue-template authoring/publishing (`api/authoring`, `application/authoring`).
 * Merged from the former `floorplan` and `floorplan-authoring` Nest library
 * modules (2026-09-01) — same physical-layout domain, different lifecycle
 * stage; kept as two sub-areas under one context rather than two libraries.
 *
 * Owned tables: FloorPlan, FloorPlanObject, OpsFloorPlanDraft, EventInstance,
 * PublishedSnapshot, VenueTemplate, OpsEvent (floorplan-status fields only;
 * primary event lifecycle owned by inquiry-onboarding).
 * Read-only: none.
 */
@Module({
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, TrustOpsModule, NotificationOpsModule, IdentityOpsModule],
  controllers: [OpsEventFloorplansController, LayoutEventsController, PlansController, PublishController, TemplatesController],
  providers: [
    FloorPlanWorkflowService,
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
