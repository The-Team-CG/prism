import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
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
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async get(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.Client, OpsUserRole.System], 'walk-in policy', eventId);
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, include: { inquiry: true } });
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
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'walk-in policy update', eventId);
    return this.policy.update(eventId, input, actor);
  }
}
