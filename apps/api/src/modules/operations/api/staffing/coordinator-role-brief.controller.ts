import { BadRequestException, Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { coordinatorRoleSchema, upsertCoordinatorRoleBriefSchema, type PrismVerifiedEventActor, type UpsertCoordinatorRoleBriefInput } from '@prism/types';
import { CoordinatorRoleBriefService } from '../../application/staffing/coordinator-role-brief.service';

@Controller('events/:eventId/coordinator-role-briefs')
export class CoordinatorRoleBriefController {
  constructor(
    private readonly access: EventAccessPolicyService,
    private readonly briefs: CoordinatorRoleBriefService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async list(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator], 'coordinator role briefs', eventId);
    return this.briefs.list(eventId, actor);
  }

  @Put(':role')
  @UseGuards(EventSessionGuard)
  async upsert(
    @Param('eventId') eventId: string,
    @Param('role') roleParam: string,
    @Body(zodBody(upsertCoordinatorRoleBriefSchema)) input: UpsertCoordinatorRoleBriefInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'coordinator role brief update', eventId);
    const role = coordinatorRoleSchema.safeParse(roleParam);
    if (!role.success) throw new BadRequestException('Unknown coordinator role');
    return this.briefs.upsert(eventId, role.data, input, actor);
  }
}
