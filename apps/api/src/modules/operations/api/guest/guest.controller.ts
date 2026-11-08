import { BadRequestException, Body, Controller, Get, Headers, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
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
  type PrismGuestCheckInReceipt,
  type CreateGuestFeedbackInput,
  type ModerateGuestFeedbackInput,
  type WithdrawGuestFeedbackConsentInput,
  type ImportGuestRosterInput,
  type CoordinatorWalkInCheckInInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { GuestWorkflowService } from '../../application/guest/guest-workflow.service';
import { GuestAccessRateLimitGuard } from './guest-access-rate-limit.guard';

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
    @Query('reviewQueue') reviewQueue: string | undefined,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'guest roster search', eventId);
    if (reviewQueue !== undefined && reviewQueue !== 'true' && reviewQueue !== 'false') {
      throw new BadRequestException('Invalid guest review queue filter');
    }
    const filters = {
      query,
      namePrefix,
      eligibility,
      checkedIn: checkedIn === undefined ? undefined : checkedIn === 'true',
      reviewQueue: reviewQueue === undefined ? undefined : reviewQueue === 'true',
    };
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

  @Post('events/:eventId/roster/:rosterEntryId/flag-for-verification')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(EventSessionGuard)
  async flagWalkInForVerification(
    @Param('eventId') eventId: string,
    @Param('rosterEntryId') rosterEntryId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'walk-in verification flag', eventId);
    return this.guestWorkflowService.flagWalkInForVerification(eventId, rosterEntryId, actor);
  }

  @Get('events/:accessCode')
  @UseGuards(GuestAccessRateLimitGuard)
  async eventByAccessCode(@Param('accessCode') accessCode: string) {
    const event = await this.guestWorkflowService.getEventByAccessCode(accessCode);
    return this.guestWorkflowService.mapGuestEvent(event);
  }

  @Get('events/:accessCode/watermark')
  @UseGuards(GuestAccessRateLimitGuard)
  async eventWatermarkByAccessCode(@Param('accessCode') accessCode: string) {
    return this.guestWorkflowService.getEventWatermarkByAccessCode(accessCode);
  }

  @Post('events/:accessCode/check-ins')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GuestAccessRateLimitGuard)
  async checkIn(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestCheckInSchema)) dto: CreateGuestCheckInInput,
  ): Promise<PrismGuestCheckInReceipt> {
    await this.guestWorkflowService.checkInByAccessCode(accessCode, dto);
    return { accepted: true };
  }

  @Post('events/:accessCode/feedback')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GuestAccessRateLimitGuard)
  async submitFeedback(
    @Param('accessCode') accessCode: string,
    @Body(zodBody(createGuestFeedbackSchema)) dto: CreateGuestFeedbackInput,
  ) {
    return this.guestWorkflowService.submitFeedbackByAccessCode(accessCode, dto);
  }

  /** New-SEC3: raw file bytes; the store checks size, checksum and file signature before keeping them. */
  @Post('events/:accessCode/feedback-media')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GuestAccessRateLimitGuard)
  async uploadFeedbackMedia(
    @Param('accessCode') accessCode: string,
    @Headers('content-type') contentType: string | undefined,
    @Headers('x-prism-file-name') encodedFileName: string | undefined,
    @Req() request: Request,
  ) {
    if (!contentType || !encodedFileName) throw new BadRequestException('A file name and content type are required');
    const bytes = await readGuestMediaBytes(request);
    return this.guestWorkflowService.uploadFeedbackMediaByAccessCode(accessCode, { fileName: decodeURIComponent(encodedFileName), contentType: contentType.split(';')[0].trim(), bytes });
  }

  @Post('events/:accessCode/feedback/:feedbackId/consent-withdrawal')
  @HttpCode(HttpStatus.OK)
  @UseGuards(GuestAccessRateLimitGuard)
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

/** Guest feedback media matches the guest_feedback_media storage limit (100 MB). */
const MAX_GUEST_MEDIA_BYTES = 100 * 1024 * 1024;

async function readGuestMediaBytes(request: Request): Promise<Uint8Array> {
  const declaredLength = Number(request.headers['content-length']);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GUEST_MEDIA_BYTES) throw new BadRequestException('File exceeds the allowed size');
  const chunks: Buffer[] = [];
  let byteSize = 0;
  for await (const chunk of request as unknown as AsyncIterable<Uint8Array>) {
    byteSize += chunk.byteLength;
    if (byteSize > MAX_GUEST_MEDIA_BYTES) throw new BadRequestException('File exceeds the allowed size');
    chunks.push(Buffer.from(chunk));
  }
  if (byteSize === 0) throw new BadRequestException('The file is empty');
  return new Uint8Array(Buffer.concat(chunks));
}
