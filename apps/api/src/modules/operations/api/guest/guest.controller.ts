import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import { zodBody } from '@prism/kernel/shared';
import {
  createGuestCheckInSchema,
  createGuestFeedbackSchema,
  moderateGuestFeedbackSchema,
  withdrawGuestFeedbackConsentSchema,
  importGuestRosterSchema,
  coordinatorWalkInCheckInSchema,
  updateGuestVerificationSchema,
  type GuestRosterSearchInput,
  type UpdateGuestVerificationInput,
  type CreateGuestCheckInInput,
  type CreateGuestFeedbackInput,
  type ModerateGuestFeedbackInput,
  type WithdrawGuestFeedbackConsentInput,
  type ImportGuestRosterInput,
  type CoordinatorWalkInCheckInInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { GuestWorkflowService } from '../../application/guest/guest-workflow.service';

@Controller('guest')
export class OpsGuestController {
  constructor(private readonly guestWorkflowService: GuestWorkflowService, private readonly eventAccessPolicyService: EventAccessPolicyService) {}

  @Post('events/:eventId/roster/import')
  @UseGuards(EventSessionGuard)
  async importRoster(@Param('eventId') eventId: string, @Body(zodBody(importGuestRosterSchema)) dto: ImportGuestRosterInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'guest roster import', eventId);
    return this.guestWorkflowService.importRoster(eventId, dto, actor);
  }

  @Get('events/:eventId/roster')
  @UseGuards(EventSessionGuard)
  async searchRoster(@Param('eventId') eventId: string, @Query('query') query: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'guest roster search', eventId);
    const filters = {
      query: query ?? '',
      namePrefix: undefined,
      eligibility: undefined,
      checkedIn: undefined,
    };
    return actor.role === OpsUserRole.Coordinator
      ? this.guestWorkflowService.searchCoordinatorRoster(eventId, actor, filters)
      : this.guestWorkflowService.searchRoster(eventId, filters);
  }

  @Get('events/:eventId/roster/search')
  @UseGuards(EventSessionGuard)
  async searchRosterWithFilters(
    @Param('eventId') eventId: string,
    @Query('query') query: string | undefined,
    @Query('namePrefix') namePrefix: string | undefined,
    @Query('eligibility') eligibility: GuestRosterSearchInput['eligibility'],
    @Query('checkedIn') checkedIn: string | undefined,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'guest roster search', eventId);
    const filters = { query, namePrefix, eligibility, checkedIn: checkedIn === undefined ? undefined : checkedIn === 'true' };
    return actor.role === OpsUserRole.Coordinator
      ? this.guestWorkflowService.searchCoordinatorRoster(eventId, actor, filters)
      : this.guestWorkflowService.searchRoster(eventId, filters);
  }

  @Post('events/:eventId/roster/:rosterEntryId/check-in')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  async checkInRoster(
    @Param('eventId') eventId: string,
    @Param('rosterEntryId') rosterEntryId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.Coordinator, OpsUserRole.System], 'guest roster check-in', eventId);
    const checkIn = await this.guestWorkflowService.checkInRosterEntry(eventId, rosterEntryId, actor);
    return this.guestWorkflowService.mapGuestCheckIn(checkIn);
  }

  @Post('events/:eventId/walk-ins')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  async registerWalkIn(
    @Param('eventId') eventId: string,
    @Body(zodBody(coordinatorWalkInCheckInSchema)) input: CoordinatorWalkInCheckInInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.Coordinator], 'coordinator walk-in registration', eventId);
    return this.guestWorkflowService.registerWalkIn(eventId, input, actor);
  }

  @Patch('events/:eventId/roster/:rosterEntryId/verification')
  @UseGuards(EventSessionGuard)
  async verifyRoster(
    @Param('eventId') eventId: string,
    @Param('rosterEntryId') rosterEntryId: string,
    @Body(zodBody(updateGuestVerificationSchema)) input: UpdateGuestVerificationInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'guest roster verification', eventId);
    return this.guestWorkflowService.updateVerification(eventId, rosterEntryId, input, actor);
  }

  @Get('events/:accessCode')
  async eventByAccessCode(@Param('accessCode') accessCode: string) {
    const event = await this.guestWorkflowService.getEventByAccessCode(accessCode);
    const attendanceCount = await this.guestWorkflowService.countCheckInsForEvent(event.id);
    return this.guestWorkflowService.mapGuestEvent(event, attendanceCount);
  }

  @Get('events/:accessCode/watermark')
  async eventWatermarkByAccessCode(@Param('accessCode') accessCode: string) {
    return this.guestWorkflowService.getEventWatermarkByAccessCode(accessCode);
  }

  @Post('events/:accessCode/check-ins')
  @HttpCode(HttpStatus.CREATED)
  async checkIn(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestCheckInSchema)) dto: CreateGuestCheckInInput,
  ) {
    return this.guestWorkflowService.checkInByAccessCode(accessCode, dto);
  }

  @Post('events/:accessCode/feedback')
  @HttpCode(HttpStatus.CREATED)
  async submitFeedback(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestFeedbackSchema)) dto: CreateGuestFeedbackInput,
  ) {
    return this.guestWorkflowService.submitFeedbackByAccessCode(accessCode, dto);
  }

  @Post('events/:accessCode/feedback/:feedbackId/consent-withdrawal')
  @HttpCode(HttpStatus.OK)
  async withdrawFeedbackConsent(
    @Param('accessCode') accessCode: string,
    @Param('feedbackId') feedbackId: string,
    @Body(zodBody(withdrawGuestFeedbackConsentSchema)) dto: WithdrawGuestFeedbackConsentInput,
  ) {
    return this.guestWorkflowService.withdrawFeedbackConsentByAccessCode(accessCode, feedbackId, dto);
  }

  @Get('events/:eventId/feedback/moderation')
  @UseGuards(EventSessionGuard)
  async pendingFeedback(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'guest feedback moderation queue', eventId);
    const feedback = await this.guestWorkflowService.listPendingFeedbackForEvent(eventId);
    return feedback.map((item) => this.guestWorkflowService.mapGuestFeedback(item));
  }

  @Post('events/:eventId/feedback/:feedbackId/moderate')
  @UseGuards(EventSessionGuard)
  async moderateFeedback(
    @Param('eventId') eventId: string,
    @Param('feedbackId') feedbackId: string,
    @Body(zodBody(moderateGuestFeedbackSchema)) dto: ModerateGuestFeedbackInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'guest feedback moderation', eventId);
    const feedback = await this.guestWorkflowService.moderateFeedback(eventId, feedbackId, dto, actor);
    return this.guestWorkflowService.mapGuestFeedback(feedback);
  }
}
