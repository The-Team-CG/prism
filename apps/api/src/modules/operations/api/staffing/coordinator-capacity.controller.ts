import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import {
  createCoordinatorAvailabilitySchema,
  createCoordinatorCoverageRequirementSchema,
  type CreateCoordinatorAvailabilityInput,
  type CreateCoordinatorCoverageRequirementInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { CoordinatorsService } from '../../application/staffing/coordinators.service';

@Controller('events')
export class OpsCoordinatorCapacityController {
  constructor(
    private readonly coordinatorsService: CoordinatorsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/staffing/coverage')
  @UseGuards(EventSessionGuard)
  getCoverage(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator coverage', eventId)
      .then(() => this.coordinatorsService.listCoverageForEvent(eventId));
  }

  @Post(':eventId/staffing/coverage')
  @UseGuards(EventSessionGuard)
  upsertCoverage(
    @Param('eventId') eventId: string,
    @Body(zodBody(createCoordinatorCoverageRequirementSchema)) dto: CreateCoordinatorCoverageRequirementInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.coordinatorsService.upsertCoverageRequirement(eventId, dto, actor);
  }

  @Post(':eventId/staffing/acknowledgement-reminders')
  @UseGuards(EventSessionGuard)
  enqueueReminders(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.coordinatorsService.enqueueAcknowledgementReminders(eventId, actor);
  }

  @Get(':eventId/coordinators/:coordinatorId/availability')
  @UseGuards(EventSessionGuard)
  getAvailability(@Param('eventId') eventId: string, @Param('coordinatorId') coordinatorId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator availability', eventId)
      .then(() => this.coordinatorsService.listAvailability(coordinatorId));
  }

  @Post(':eventId/coordinators/:coordinatorId/availability')
  @UseGuards(EventSessionGuard)
  createAvailability(
    @Param('eventId') eventId: string,
    @Param('coordinatorId') coordinatorId: string,
    @Body(zodBody(createCoordinatorAvailabilitySchema)) dto: CreateCoordinatorAvailabilityInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator availability', eventId)
      .then(() => this.coordinatorsService.createAvailability(coordinatorId, dto, actor, eventId));
  }

  @Delete(':eventId/coordinators/:coordinatorId/availability/:availabilityId')
  @UseGuards(EventSessionGuard)
  deleteAvailability(
    @Param('eventId') eventId: string,
    @Param('coordinatorId') coordinatorId: string,
    @Param('availabilityId') availabilityId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator availability', eventId)
      .then(() => this.coordinatorsService.deleteAvailability(coordinatorId, availabilityId, actor, eventId));
  }
}
