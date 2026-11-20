import { Controller, Get, Header, Param, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodQuery } from '@prism/kernel/shared';
import { pmcmCalendarQuerySchema, type PmcmCalendarQuery, type PrismVerifiedEventActor } from '@prism/types';
import { PmcmOverviewService } from '../application/services/pmcm-overview.service';

@Controller('pmcm')
export class OpsPmcmOverviewController {
  constructor(
    private readonly overview: PmcmOverviewService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get('event-summaries')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  eventSummaries(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.overview.eventSummaries(this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get('client-facts')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  clientFacts(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.overview.clientFacts(this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get('supplier-next-bookings')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  supplierNextBookings(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.overview.supplierNextBookings(this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get('events/:eventId/client-activity')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  clientActivity(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.overview.clientActivity(this.eventAccessPolicyService.resolveActor({}, verifiedActor), eventId);
  }

  @Get('file-summaries')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  fileSummaries(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.overview.fileSummaries(this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Get('calendar')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(EventSessionGuard)
  calendar(
    @Query(zodQuery(pmcmCalendarQuerySchema)) query: PmcmCalendarQuery,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.overview.calendar(this.eventAccessPolicyService.resolveActor({}, verifiedActor), query);
  }
}
