import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { pmcmCommandInboxQuerySchema, pmcmEventAttentionQuerySchema, type PmcmEventAttentionQuery, type PrismVerifiedEventActor } from '@prism/types';
import { zodQuery } from '@prism/kernel/shared';
import { EventReadModelsService } from '../application/services/event-read-models.service';

@Controller('pmcm')
export class OpsPmcmCommandInboxController {
  constructor(
    private readonly eventReadModelsService: EventReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('command-inbox')
  @UseGuards(EventSessionGuard)
  commandInbox(@Query('page') page: string | undefined, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const parsedQuery = pmcmCommandInboxQuerySchema.safeParse({ page });
    if (!parsedQuery.success) throw new BadRequestException('Invalid command inbox page');
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventReadModelsService.pmcmCommandInbox(actor, parsedQuery.data.page);
  }

  /** The Inbox's items grouped by event, for the Events cards. */
  @Get('event-attention')
  @UseGuards(EventSessionGuard)
  eventAttention(@Query(zodQuery(pmcmEventAttentionQuerySchema)) query: PmcmEventAttentionQuery, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.eventReadModelsService.pmcmEventAttention(this.eventAccessPolicyService.resolveActor({}, verifiedActor), query.eventId);
  }
}
