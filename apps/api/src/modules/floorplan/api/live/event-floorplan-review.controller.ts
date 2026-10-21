import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createFloorPlanRevisionCommentSchema,
  type CreateFloorPlanRevisionCommentInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { FloorPlanReviewService } from '../../application/live/floor-plan-review.service';

@Controller('events')
export class EventFloorPlanReviewController {
  constructor(
    private readonly floorPlanReviewService: FloorPlanReviewService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch(':eventId/floorplans/:draftId/review')
  @UseGuards(EventSessionGuard)
  async submitRevisionComment(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @Body(zodBody(createFloorPlanRevisionCommentSchema)) input: CreateFloorPlanRevisionCommentInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.floorPlanReviewService.submitRevisionComment(eventId, draftId, input, actor);
  }
}