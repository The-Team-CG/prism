import { Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { mapEventInsight } from '@prism/contexts/event-lifecycle';
import { EventInsightGenerationService } from './event-insight-generation.service';

@Controller('events')
export class EventInsightGenerationController {
  constructor(
    private readonly eventInsightGenerationService: EventInsightGenerationService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/insights/generate')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async generate(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const insight = await this.eventInsightGenerationService.generate(eventId, actor);
    return mapEventInsight(insight);
  }
}
