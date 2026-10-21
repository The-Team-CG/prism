import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  scheduleOcularVisitSchema,
  submitClientOcularVisitSchema,
  waiveOcularVisitSchema,
  type PrismVerifiedEventActor,
  type ScheduleOcularVisitInput,
  type SubmitClientOcularVisitInput,
  type WaiveOcularVisitInput,
} from '@prism/types';
import { OcularVisitService } from '../../application/ocular-visit/ocular-visit.service';

@Controller('events')
export class OcularVisitController {
  constructor(
    private readonly ocularVisitService: OcularVisitService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/ocular-visit')
  @UseGuards(EventSessionGuard)
  async submitClientRequest(
    @Param('eventId') eventId: string,
    @Body(zodBody(submitClientOcularVisitSchema)) input: SubmitClientOcularVisitInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.Client],
      'client ocular visit request',
      eventId,
    );
    return this.ocularVisitService.submitClientRequest(eventId, input, actor);
  }

  @Patch(':eventId/ocular-visit/schedule')
  @UseGuards(EventSessionGuard)
  async scheduleOcularVisit(
    @Param('eventId') eventId: string,
    @Body(zodBody(scheduleOcularVisitSchema)) input: ScheduleOcularVisitInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin],
      'PMCM ocular visit task',
      eventId,
    );
    return this.ocularVisitService.scheduleOcularVisit(eventId, input, actor);
  }

  @Post(':eventId/ocular-visit/complete')
  @UseGuards(EventSessionGuard)
  async completeOcularVisit(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin],
      'PMCM ocular visit task',
      eventId,
    );
    return this.ocularVisitService.completeOcularVisit(eventId, actor);
  }

  @Post(':eventId/ocular-visit/waive')
  @UseGuards(EventSessionGuard)
  async waiveOcularVisit(
    @Param('eventId') eventId: string,
    @Body(zodBody(waiveOcularVisitSchema)) input: WaiveOcularVisitInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin],
      'PMCM ocular visit task',
      eventId,
    );
    return this.ocularVisitService.waiveOcularVisit(eventId, input, actor);
  }
}
