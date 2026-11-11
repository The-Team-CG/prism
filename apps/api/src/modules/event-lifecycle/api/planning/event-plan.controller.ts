import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  applyEventPlanSchema,
  previewEventPlanSchema,
  updateEventPlanItemSchema,
  type ApplyEventPlanInput,
  type PreviewEventPlanInput,
  type PrismVerifiedEventActor,
  type UpdateEventPlanItemInput,
} from '@prism/types';
import { EventPlanService } from '../../application/planning/event-plan.service';

/** An event's plan is PMCM's working list. Clients, suppliers, guests and coordinators never reach it. */
@Controller('events')
@UseGuards(EventSessionGuard)
export class EventPlanController {
  constructor(
    private readonly plans: EventPlanService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/plan')
  async list(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requirePmcm(verifiedActor, 'event plan', eventId);
    return this.plans.listItems(eventId);
  }

  /** Changes nothing: shows what applying the template would add, update, keep and leave. */
  @Post(':eventId/plan/preview')
  @HttpCode(HttpStatus.OK)
  async preview(
    @Param('eventId') eventId: string,
    @Body(zodBody(previewEventPlanSchema)) dto: PreviewEventPlanInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    await this.requirePmcm(verifiedActor, 'event plan preview', eventId);
    return this.plans.preview(eventId, dto);
  }

  @Post(':eventId/plan/apply')
  @HttpCode(HttpStatus.OK)
  async apply(
    @Param('eventId') eventId: string,
    @Body(zodBody(applyEventPlanSchema)) dto: ApplyEventPlanInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.plans.apply(eventId, dto, await this.requirePmcm(verifiedActor, 'event plan apply', eventId));
  }

  @Patch(':eventId/plan/items/:itemId')
  async updateItem(
    @Param('eventId') eventId: string,
    @Param('itemId') itemId: string,
    @Body(zodBody(updateEventPlanItemSchema)) dto: UpdateEventPlanItemInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.plans.updateItem(eventId, itemId, dto, await this.requirePmcm(verifiedActor, 'event plan task', eventId));
  }

  private async requirePmcm(verifiedActor: PrismVerifiedEventActor, resource: string, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource, eventId);
    if (!actor.id?.trim()) throw new ForbiddenException('Verified actor ID is required');
    return { id: actor.id, name: actor.name, role: actor.role, email: actor.email };
  }
}
