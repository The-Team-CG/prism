import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { addCommunicationParticipantsSchema, communicationInboxQuerySchema, communicationThreadsQuerySchema, communicationUnreadCountQuerySchema, createCommunicationThreadSchema, sendCommunicationMessageSchema, updateCommunicationThreadStatusSchema, type AddCommunicationParticipantsInput, type CommunicationInboxQuery, type CommunicationThreadsQuery, type CommunicationUnreadCountQuery, type CreateCommunicationThreadInput, type PrismVerifiedEventActor, type SendCommunicationMessageInput, type UpdateCommunicationThreadStatusInput } from '@prism/types';
import { zodBody, zodQuery } from '@prism/kernel/shared';
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
  list(@Query(zodQuery(communicationThreadsQuerySchema)) query: CommunicationThreadsQuery, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listThreads(query, this.access.resolveActor({}, verified));
  }

  @Get('threads/:threadId')
  thread(@Param('threadId') threadId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.getThread(threadId, this.access.resolveActor({}, verified));
  }

  @Get('inbox')
  inbox(@Query(zodQuery(communicationInboxQuerySchema)) query: CommunicationInboxQuery, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.listInbox(query, this.access.resolveActor({}, verified));
  }

  @Get('unread-count')
  unreadCount(@Query(zodQuery(communicationUnreadCountQuerySchema)) query: CommunicationUnreadCountQuery, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.unreadCount(query, this.access.resolveActor({}, verified));
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

  @Patch('threads/:threadId')
  updateStatus(@Param('threadId') threadId: string, @Body(zodBody(updateCommunicationThreadStatusSchema)) input: UpdateCommunicationThreadStatusInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.setStatus(threadId, input, this.access.resolveActor({}, verified));
  }

  @Post('threads/:threadId/participants')
  addParticipants(@Param('threadId') threadId: string, @Body(zodBody(addCommunicationParticipantsSchema)) input: AddCommunicationParticipantsInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.addParticipants(threadId, input, this.access.resolveActor({}, verified));
  }

  @Delete('threads/:threadId/participants/:actorId')
  removeParticipant(@Param('threadId') threadId: string, @Param('actorId') actorId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.removeParticipant(threadId, actorId, this.access.resolveActor({}, verified));
  }

  @Get('threads/:threadId/read-receipts')
  readReceipts(@Param('threadId') threadId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.readReceipts(threadId, this.access.resolveActor({}, verified));
  }
}
