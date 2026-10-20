import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodQuery } from '@prism/kernel/shared';
import { decisionLogQuerySchema, type PrismDecisionLogQuery, type PrismVerifiedEventActor } from '@prism/types';
import { DecisionLogReadModelsService } from '../application/services/decision-log-read-models.service';

@Controller('events')
export class OpsDecisionLogController {
  constructor(
    private readonly decisionLogService: DecisionLogReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/decision-log')
  @UseGuards(EventSessionGuard)
  decisionLog(
    @Param('eventId') eventId: string,
    @Query(zodQuery(decisionLogQuerySchema)) query: PrismDecisionLogQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.decisionLogService.getDecisionLog(eventId, actor, query);
  }
}
