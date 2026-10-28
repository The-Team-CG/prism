import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Inject, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { scopeActorToEvent } from '@prism/contexts/read-models/event-scope';
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
import {
  EVENT_CLIENT_FLOORPLAN_ACCESS_READER,
  type EventClientFloorplanAccessReader,
} from '@prism/contexts/event-lifecycle';

@Controller('events')
export class OpsEventFloorplansController {
  constructor(
    private readonly floorPlanWorkflowService: FloorPlanWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(EVENT_CLIENT_FLOORPLAN_ACCESS_READER)
    private readonly clientFloorplanAccessReader: EventClientFloorplanAccessReader,
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
      actorId: verifiedActor.actorId,
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
      actorId: verifiedActor.actorId,
      name: actor.name,
      role: actor.role,
    });
  }

  @Post(':eventId/floorplans/:draftId/reopen-preference')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.OK)
  async reopenClientPreference(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireCanMutateOfficialFloorplan(
      actor,
      eventId,
      'client floorplan preference reopen',
    );
    return this.floorPlanWorkflowService.reopenClientPreference(eventId, draftId, {
      actorId: verifiedActor.actorId,
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
    const scoped = scopeActorToEvent(actor, event);
    if (scoped.actor.role === OpsUserRole.Client) {
      const primaryContactCanRead = this.eventAccessPolicyService.canReadEvent(scoped.actor, event, scoped.scope);
      const hasSecondaryGrant = !primaryContactCanRead && scoped.actor.id
        ? await this.clientFloorplanAccessReader.hasActiveGrant(eventId, scoped.actor.id)
        : false;
      if (!primaryContactCanRead && !hasSecondaryGrant) {
        await this.eventAccessPolicyService.requireCanReadEvent(
          scoped.actor,
          event,
          'official floorplan snapshot',
          scoped.scope,
        );
        throw new ForbiddenException('Client cannot access official floorplan snapshot');
      }
    } else {
      await this.eventAccessPolicyService.requireCanReadEvent(
        scoped.actor,
        event,
        'official floorplan snapshot',
        scoped.scope,
      );
    }
    // Event access runs first so coordinator assignment and supplier scope remain authoritative.
    // Snapshot access then narrows the roles: coordinators may read only the final approved artifact.
    const allowedRoles =
      type === 'submitted'
        ? [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System]
        : [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator];
    await this.eventAccessPolicyService.requireActorRole(
      scoped.actor,
      allowedRoles,
      `official floorplan ${type} snapshot`,
      eventId,
    );
    return this.floorPlanWorkflowService.getFloorPlanSnapshot(eventId, draftId, type);
  }

  @Get(':eventId/floorplans/:draftId/history')
  @UseGuards(EventSessionGuard)
  async getFloorPlanHistory(
    @Param('eventId') eventId: string,
    @Param('draftId') draftId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const event = await this.requireEvent(eventId);
    const scoped = scopeActorToEvent(actor, event);
    if (scoped.actor.role === OpsUserRole.Client) {
      const primaryContactCanRead = this.eventAccessPolicyService.canReadEvent(scoped.actor, event, scoped.scope);
      const hasSecondaryGrant = !primaryContactCanRead && scoped.actor.id
        ? await this.clientFloorplanAccessReader.hasActiveGrant(eventId, scoped.actor.id)
        : false;
      if (!primaryContactCanRead && !hasSecondaryGrant) {
        await this.eventAccessPolicyService.requireCanReadEvent(scoped.actor, event, 'official floorplan history', scoped.scope);
        throw new ForbiddenException('Client cannot access official floorplan history');
      }
    } else {
      await this.eventAccessPolicyService.requireCanReadEvent(scoped.actor, event, 'official floorplan history', scoped.scope);
    }
    await this.eventAccessPolicyService.requireActorRole(
      scoped.actor,
      [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'official floorplan history',
      eventId,
    );
    return this.floorPlanWorkflowService.listFloorPlanSnapshotHistory(
      eventId,
      draftId,
      scoped.actor.role === OpsUserRole.PmcmAdmin || scoped.actor.role === OpsUserRole.System ? undefined : ['approved'],
    );
  }

  private requireEvent(eventId: string) {
    return this.floorPlanWorkflowService.requireEvent(eventId);
  }
}
