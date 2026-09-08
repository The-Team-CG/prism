import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { createCommunicationThreadSchema, sendCommunicationMessageSchema, type CreateCommunicationThreadInput, type PrismVerifiedEventActor, type SendCommunicationMessageInput } from '@prism/types';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { CommunicationService } from '../../application/suppliers/communication.service';

@Controller('communication')
@UseGuards(EventSessionGuard)
export class CommunicationController {
  constructor(private readonly service: CommunicationService, private readonly access: EventAccessPolicyService) {}

  @Post('threads')
  create(@Body(zodBody(createCommunicationThreadSchema)) input: CreateCommunicationThreadInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.createThread(input, this.access.resolveActor({}, verified));
  }

  @Get('threads')
  list(@Query('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listThreads(eventId, this.access.resolveActor({}, verified));
  }

  @Get('participants')
  participants(@Query('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listEligibleParticipants(eventId, this.access.resolveActor({}, verified));
  }

  @Post('threads/:threadId/messages')
  send(@Param('threadId') threadId: string, @Body(zodBody(sendCommunicationMessageSchema)) input: SendCommunicationMessageInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.sendMessage(threadId, input, this.access.resolveActor({}, verified));
  }

  @Get('threads/:threadId/messages')
  messages(@Param('threadId') threadId: string, @Query('cursor') cursor: string | undefined, @Query('limit', new ParseIntPipe({ optional: true })) limit: number | undefined, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listMessages(threadId, { cursor, limit }, this.access.resolveActor({}, verified));
  }

  @Post('threads/:threadId/read')
  read(@Param('threadId') threadId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.markThreadRead(threadId, this.access.resolveActor({}, verified));
  }
}
