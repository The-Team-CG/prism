import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import {
  dateChangeImpactQuerySchema,
  syncEventPlanSchema,
  type DateChangeImpactQuery,
  type PrismVerifiedEventActor,
  type SyncEventPlanInput,
} from '@prism/types';
import { EventDateImpactService } from '../../application/change/event-date-impact.service';

/** What a date change touches, and the one explicit step that moves the plan with it. PMCM admin and system only. */
@Controller('events')
@UseGuards(EventSessionGuard)
export class EventDateImpactController {
  constructor(
    private readonly impact: EventDateImpactService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  /** Read only. With `newDate`, the impact of moving the event there; without it, of the date the event has now. */
  @Get(':eventId/date-change-impact')
  async get(
    @Param('eventId') eventId: string,
    @Query(zodQuery(dateChangeImpactQuerySchema)) query: DateChangeImpactQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requirePmcm(verifiedActor, 'date change impact', eventId);
    return this.impact.impact(eventId, query);
  }

  @Post(':eventId/plan/sync')
  @HttpCode(HttpStatus.OK)
  async syncPlan(
    @Param('eventId') eventId: string,
    @Body(zodBody(syncEventPlanSchema)) dto: SyncEventPlanInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.impact.syncPlan(eventId, dto, await this.requirePmcm(verifiedActor, 'event plan date sync', eventId));
  }

  private async requirePmcm(verifiedActor: PrismVerifiedEventActor, resource: string, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
    if (!actor.id?.trim()) throw new ForbiddenException('Verified actor ID is required');
    return { id: actor.id, name: actor.name, role: actor.role, email: actor.email };
  }
}
