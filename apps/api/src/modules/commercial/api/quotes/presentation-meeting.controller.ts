import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  choosePresentationSlotSchema,
  proposePresentationMeetingSchema,
  recordPresentationOutcomeSchema,
  type ChoosePresentationSlotInput,
  type PrismVerifiedEventActor,
  type ProposePresentationMeetingInput,
  type RecordPresentationOutcomeInput,
} from '@prism/types';
import { PresentationMeetingService } from '../../application/quotes/presentation-meeting.service';

@Controller('events/:eventId/presentation-meetings')
@UseGuards(EventSessionGuard)
export class PresentationMeetingController {
  constructor(private readonly service: PresentationMeetingService, private readonly access: EventAccessPolicyService) {}

  @Get()
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.list(eventId, this.access.resolveActor({}, verified));
  }

  @Post()
  propose(@Param('eventId') eventId: string, @Body(zodBody(proposePresentationMeetingSchema)) input: ProposePresentationMeetingInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.propose(eventId, input, this.access.resolveActor({}, verified));
  }

  @Post(':meetingId/choice')
  choose(@Param('eventId') eventId: string, @Param('meetingId') meetingId: string, @Body(zodBody(choosePresentationSlotSchema)) input: ChoosePresentationSlotInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.choose(eventId, meetingId, input, this.access.resolveActor({}, verified));
  }

  @Post(':meetingId/outcome')
  outcome(@Param('eventId') eventId: string, @Param('meetingId') meetingId: string, @Body(zodBody(recordPresentationOutcomeSchema)) input: RecordPresentationOutcomeInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.recordOutcome(eventId, meetingId, input, this.access.resolveActor({}, verified));
  }
}
