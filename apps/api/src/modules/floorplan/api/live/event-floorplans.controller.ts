import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createFloorPlanDraftSchema,
  createFloorPlanPreferenceSchema,
  type CreateFloorPlanDraftInput,
  type CreateFloorPlanPreferenceInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import {
  FloorPlanSnapshotQueryDto,
} from './floorplan.dto';
import { FloorPlanWorkflowService } from '../../application/live/floor-plan-workflow.service';

@Controller('events')
export class OpsEventFloorplansController {
  constructor(
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/floorplans')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createFloorPlanDraft(
    @Param('eventId') eventId: string,
    @Body(zodBody(createFloorPlanDraftSchema)) dto: CreateFloorPlanDraftInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(actor, eventId, 'official floorplan draft');
    return this.floorPlanWorkflowService.createFloorPlanDraft(eventId, dto, {
      name: actor.name,
      role: actor.role,
    });
  }

  @Post(':eventId/floorplan-preferences')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createFloorPlanPreference(
    @Param('eventId') eventId: string,
    @Body(zodBody(createFloorPlanPreferenceSchema)) dto: CreateFloorPlanPreferenceInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'client floorplan preference',
      eventId,
    );
    const event = await this.requireEvent(eventId);
    if (!this.eventAccessPolicyService.canReadEvent(actor, event) && actor.role === OpsUserRole.Client) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'client floorplan preference', eventId);
      throw new ForbiddenException('client cannot access this event floorplan preference');
    }
    return this.floorPlanWorkflowService.createFloorPlanPreference(eventId, dto, {
      name: actor.name,
      role: actor.role,
    });
  }

  @Post(':eventId/floorplans/:draftId/submit')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async submitFloorPlanDraft(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(actor, eventId, 'official floorplan submit');
    return this.floorPlanWorkflowService.submitFloorPlanDraft(eventId, draftId, {
      name: actor.name,
      role: actor.role,
    });
  }

  @Post(':eventId/floorplans/:draftId/approve')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async approveFloorPlanDraft(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(actor, eventId, 'official floorplan approve');
    return this.floorPlanWorkflowService.approveFloorPlanDraft(eventId, draftId, {
      name: actor.name,
      role: actor.role,
    });
  }

  @Get(':eventId/floorplans/:draftId/snapshot')
  @UseGuards(EventSessionGuard)
  async getFloorPlanSnapshot(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @Query() query: FloorPlanSnapshotQueryDto,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const { type = 'approved' } = query;
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const event = await this.requireEvent(eventId);
    if (!this.eventAccessPolicyService.canReadEvent(actor, event)) {
      await this.eventAccessPolicyService.recordForbiddenAccess(actor, 'official floorplan snapshot', eventId);
      throw new ForbiddenException(`${actor.role} cannot access official floorplan snapshot`);
    }
    return this.floorPlanWorkflowService.getFloorPlanSnapshot(eventId, draftId, type);
  }

  private requireEvent(eventId: string) {
    return this.floorPlanWorkflowService.requireEvent(eventId);
  }
}
