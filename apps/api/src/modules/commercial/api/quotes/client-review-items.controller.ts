import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  createClientReviewItemSchema,
  decideClientReviewItemSchema,
  type CreateClientReviewItemInput,
  type DecideClientReviewItemInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { ClientReviewItemsService } from '../../application/quotes/client-review-items.service';

@Controller('events/:eventId/client-review-items')
export class OpsClientReviewItemsController {
  constructor(
    private readonly clientReviewItemsService: ClientReviewItemsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientReviewItemsService.list(eventId, actor);
  }

  @Post()
  @UseGuards(EventSessionGuard)
  create(
    @Param('eventId') eventId: string,
    @Body(zodBody(createClientReviewItemSchema)) input: CreateClientReviewItemInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientReviewItemsService.issue(eventId, input, actor);
  }

  @Post(':itemId/decisions')
  @UseGuards(EventSessionGuard)
  decide(
    @Param('eventId') eventId: string,
    @Param('itemId') itemId: string,
    @Body(zodBody(decideClientReviewItemSchema)) input: DecideClientReviewItemInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientReviewItemsService.decide(eventId, itemId, input, actor);
  }
}
