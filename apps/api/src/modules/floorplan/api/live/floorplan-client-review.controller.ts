import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  createClientFloorPlanAnnotationSchema,
  decideClientFloorPlanSchema,
  type CreateClientFloorPlanAnnotationInput,
  type DecideClientFloorPlanInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { FloorPlanClientReviewService } from '../../application/live/floorplan-client-review.service';

@Controller('events/:eventId/floorplans/:draftId')
export class FloorplanClientReviewController {
  constructor(
    private readonly floorPlanClientReviewService: FloorPlanClientReviewService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('client-review')
  @UseGuards(EventSessionGuard)
  getReview(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.floorPlanClientReviewService.getReview(eventId, draftId, actor);
  }

  @Post('client-review')
  @UseGuards(EventSessionGuard)
  decide(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @Body(zodBody(decideClientFloorPlanSchema)) input: DecideClientFloorPlanInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.floorPlanClientReviewService.decide(eventId, draftId, input, actor);
  }

  @Post('client-annotations')
  @UseGuards(EventSessionGuard)
  annotate(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @Body(zodBody(createClientFloorPlanAnnotationSchema)) input: CreateClientFloorPlanAnnotationInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.floorPlanClientReviewService.annotate(eventId, draftId, input, actor);
  }
}
