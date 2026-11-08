import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { decideCoordinatorReplacementSchema, type DecideCoordinatorReplacementInput, type PrismVerifiedEventActor } from '@prism/types';
import { CoordinatorReplacementRecommendationService } from '../../application/staffing/coordinator-replacement-recommendation.service';

@Controller('events/:eventId/coordinator-replacements')
@UseGuards(EventSessionGuard)
export class CoordinatorReplacementRecommendationsController {
  constructor(private readonly service: CoordinatorReplacementRecommendationService, private readonly access: EventAccessPolicyService) {}

  @Get()
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.list(eventId, this.access.resolveActor({}, verified));
  }

  @Post(':recommendationId/decision')
  decide(
    @Param('eventId') eventId: string,
    @Param('recommendationId') recommendationId: string,
    @Body(zodBody(decideCoordinatorReplacementSchema)) input: DecideCoordinatorReplacementInput,
    @VerifiedEventActor() verified: PrismVerifiedEventActor,
  ) {
    return this.service.decide(eventId, recommendationId, input, this.access.resolveActor({}, verified));
  }
}
