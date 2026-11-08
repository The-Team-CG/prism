import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { createInquiryContextNoteSchema, type CreateInquiryContextNoteInput, type PrismVerifiedEventActor } from '@prism/types';
import { InquiryContextNotesService } from '../../application/onboarding/inquiry-context-notes.service';

@Controller()
@UseGuards(EventSessionGuard)
export class InquiryContextNotesController {
  constructor(private readonly service: InquiryContextNotesService, private readonly access: EventAccessPolicyService) {}

  @Get('inquiries/:inquiryId/context-notes')
  list(@Param('inquiryId') inquiryId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.list(inquiryId, this.access.resolveActor({}, verified));
  }

  @Post('inquiries/:inquiryId/context-notes')
  add(@Param('inquiryId') inquiryId: string, @Body(zodBody(createInquiryContextNoteSchema)) input: CreateInquiryContextNoteInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.add(inquiryId, input, this.access.resolveActor({}, verified));
  }

  @Get('events/:eventId/pre-conforme-context')
  forEvent(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.forEvent(eventId, this.access.resolveActor({}, verified));
  }
}
