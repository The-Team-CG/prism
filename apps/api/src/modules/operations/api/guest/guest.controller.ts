import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import { zodBody } from '@prism/kernel/shared';
import {
  createGuestCheckInSchema,
  createGuestFeedbackSchema,
  importGuestRosterSchema,
  type CreateGuestCheckInInput,
  type CreateGuestFeedbackInput,
  type ImportGuestRosterInput,
} from '@prism/types';
import { GuestWorkflowService } from '../../application/guest/guest-workflow.service';

@Controller('guest')
export class OpsGuestController {
  constructor(private readonly guestWorkflowService: GuestWorkflowService, private readonly eventAccessPolicyService: EventAccessPolicyService) {}

  @Post('events/:eventId/roster/import')
  @UseGuards(EventSessionGuard)
  async importRoster(@Param('eventId') eventId: string, @Body(zodBody(importGuestRosterSchema)) dto: ImportGuestRosterInput, @VerifiedEventActor() verifiedActor: any) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'guest roster import', eventId);
    return this.guestWorkflowService.importRoster(eventId, dto, actor);
  }

  @Get('events/:eventId/roster')
  @UseGuards(EventSessionGuard)
  async searchRoster(@Param('eventId') eventId: string, @Query('query') query: string, @VerifiedEventActor() verifiedActor: any) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'guest roster search', eventId);
    return this.guestWorkflowService.searchRoster(eventId, query ?? '');
  }

  @Get('events/:accessCode')
  async eventByAccessCode(@Param('accessCode') accessCode: string) {
    const event = await this.guestWorkflowService.getEventByAccessCode(accessCode);
    const attendanceCount = await this.guestWorkflowService.countCheckInsForEvent(event.id);
    return this.guestWorkflowService.mapGuestEvent(event, attendanceCount);
  }

  @Post('events/:accessCode/check-ins')
  @HttpCode(HttpStatus.CREATED)
  async checkIn(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestCheckInSchema)) dto: CreateGuestCheckInInput,
  ) {
    const checkIn = await this.guestWorkflowService.checkInByAccessCode(accessCode, dto);
    return this.guestWorkflowService.mapGuestCheckIn(checkIn);
  }

  @Post('events/:accessCode/feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestFeedbackSchema)) dto: CreateGuestFeedbackInput,
  ) {
    const feedback = await this.guestWorkflowService.submitFeedbackByAccessCode(accessCode, dto);
    return this.guestWorkflowService.mapGuestFeedback(feedback);
  }
}
