import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { EventFinancialsService } from '../../application/billing/event-financials.service';

/** Where one event stands financially. It shows margin and supplier cost, so it is for PMCM finance only. */
@Controller('events')
@UseGuards(EventSessionGuard)
export class EventFinancialsController {
  constructor(
    private readonly financials: EventFinancialsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/financial-summary')
  async summary(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'event financial summary', eventId);
    return this.financials.getSummary(eventId);
  }
}
