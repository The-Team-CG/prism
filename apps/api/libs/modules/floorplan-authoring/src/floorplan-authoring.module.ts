import { Module } from '@nestjs/common';
import { DatabaseModule } from '@prism/database';
import { LayoutEventsController } from './controllers/layout-events.controller';
import { PlansController } from './controllers/plans.controller';
import { TemplatesController } from './controllers/templates.controller';
import { PublishController } from './controllers/publish.controller';
import { LayoutEventsService } from './services/layout-events.service';
import { PlansService } from './services/plans.service';
import { TemplatesService } from './services/templates.service';
import { PublishService } from './services/publish.service';

/**
 * Owned tables: EventInstance, FloorPlan (authoring/template surface; live-event floorplans are owned by floorplan), FloorPlanObject (authoring/template surface), PublishedSnapshot, VenueTemplate.
 * Read-only: none.
 *
 * Merged from the former events+plans+templates+publishing modules (2026-09-01); FloorPlan/FloorPlanObject writes here are venue-template authoring, a distinct usage from floorplan's live per-event drafts.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [LayoutEventsController, PlansController, TemplatesController, PublishController],
  providers: [LayoutEventsService, PlansService, TemplatesService, PublishService],
})
export class FloorplanAuthoringModule {}
