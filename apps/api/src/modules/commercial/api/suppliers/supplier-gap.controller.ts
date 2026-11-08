import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { acknowledgeSupplierGapSchema, type AcknowledgeSupplierGapInput, type PrismVerifiedEventActor } from '@prism/types';
import { SupplierGapService } from '../../application/suppliers/supplier-gap.service';

@Controller('events/:eventId/supplier-gaps')
export class SupplierGapController {
  constructor(private readonly access: EventAccessPolicyService, private readonly gaps: SupplierGapService) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async list(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'supplier gaps', eventId);
    return this.gaps.list(eventId);
  }

  @Post(':categoryId/acknowledge')
  @UseGuards(EventSessionGuard)
  async acknowledge(
    @Param('eventId') eventId: string,
    @Param('categoryId') categoryId: string,
    @Body(zodBody(acknowledgeSupplierGapSchema)) input: AcknowledgeSupplierGapInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin], 'supplier gap acknowledgement', eventId);
    return this.gaps.acknowledge(eventId, categoryId, input, actor);
  }
}
