import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  acknowledgeClientDeliverableSchema,
  clientTestimonialModerationSchema,
  submitClientCloseoutResponseSchema,
  type AcknowledgeClientDeliverableInput,
  type ClientTestimonialModerationInput,
  type PrismVerifiedEventActor,
  type SubmitClientCloseoutResponseInput,
} from '@prism/types';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { ClientCloseoutService } from '../../application/closure/client-closeout.service';

@Controller('events/:eventId/client-closeout')
export class ClientCloseoutController {
  constructor(
    private readonly clientCloseoutService: ClientCloseoutService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  get(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientCloseoutService.get(eventId, actor);
  }

  @Post('deliverables/:documentId/acknowledgement')
  @UseGuards(EventSessionGuard)
  acknowledgeDeliverable(
    @Param('eventId') eventId: string,
    @Param('documentId') documentId: string,
    @Body(zodBody(acknowledgeClientDeliverableSchema)) input: AcknowledgeClientDeliverableInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientCloseoutService.acknowledgeDeliverable(eventId, documentId, input, actor);
  }

  @Post('acknowledgement')
  @UseGuards(EventSessionGuard)
  acknowledgeWrapUp(
    @Param('eventId') eventId: string,
    @Body(zodBody(acknowledgeClientDeliverableSchema)) input: AcknowledgeClientDeliverableInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientCloseoutService.acknowledgeWrapUp(eventId, input, actor);
  }

  @Post('response')
  @UseGuards(EventSessionGuard)
  submitResponse(
    @Param('eventId') eventId: string,
    @Body(zodBody(submitClientCloseoutResponseSchema)) input: SubmitClientCloseoutResponseInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientCloseoutService.submitResponse(eventId, input, actor);
  }

  @Post('testimonial-consent/revoke')
  @UseGuards(EventSessionGuard)
  revokeTestimonialConsent(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientCloseoutService.revokeTestimonialConsent(eventId, actor);
  }

  @Get('moderation')
  @UseGuards(EventSessionGuard)
  getForModeration(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientCloseoutService.getForModeration(eventId, actor);
  }

  @Patch('moderation')
  @UseGuards(EventSessionGuard)
  moderate(
    @Param('eventId') eventId: string,
    @Body(zodBody(clientTestimonialModerationSchema)) input: ClientTestimonialModerationInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.clientCloseoutService.moderateTestimonial(eventId, input, actor);
  }
}
