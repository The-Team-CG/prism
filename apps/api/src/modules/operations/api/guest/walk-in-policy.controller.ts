import { Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import {
  OPERATIONS_EVENT_REFERENCE_READER,
  type OperationsEventReferenceReader,
} from '@prism/contexts/event-lifecycle/operations-reference';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { updateWalkInPolicySchema, type PrismVerifiedEventActor, type UpdateWalkInPolicyInput } from '@prism/types';
import { WalkInPolicyService } from '../../application/guest/walk-in-policy.service';

@Controller('events/:eventId/walk-in-policy')
export class WalkInPolicyController {
  constructor(
    private readonly access: EventAccessPolicyService,
    private readonly policy: WalkInPolicyService,
    @Inject(OPERATIONS_EVENT_REFERENCE_READER) private readonly eventReferences: OperationsEventReferenceReader,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async get(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.Client, OpsUserRole.System], 'walk-in policy', eventId);
    const event = await this.eventReferences.findEventReadAccess(eventId);
    if (!event) return this.policy.get(eventId);
    await this.access.requireCanReadEvent(actor, event, 'walk-in policy');
    return this.policy.get(eventId);
  }

  @Patch()
  @UseGuards(EventSessionGuard)
  async update(
    @Param('eventId') eventId: string,
    @Body(zodBody(updateWalkInPolicySchema)) input: UpdateWalkInPolicyInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Client], 'walk-in policy update', eventId);
    if (actor.role === OpsUserRole.Client) await this.requireClientCanSetPolicy(eventId, actor);
    return this.policy.update(eventId, input, actor);
  }

  /** New-CL1: the client sets the walk-in policy for their own event during planning; on event day PMCM owns it. */
  private async requireClientCanSetPolicy(eventId: string, actor: ReturnType<EventAccessPolicyService['resolveActor']>) {
    const access = await this.eventReferences.findEventReadAccess(eventId);
    if (!access) throw new NotFoundException('Event not found');
    await this.access.requireCanReadEvent(actor, access, 'walk-in policy update');
    const event = await this.eventReferences.findOperationsEvent(eventId);
    if (!event || event.archived) throw new NotFoundException('Event not found');
    if (event.eventDate.getTime() <= Date.now() || event.status === 'event_day') {
      throw new ForbiddenException('The walk-in policy is set by PMCM once event day begins');
    }
  }
}
