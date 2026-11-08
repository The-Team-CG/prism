import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { createLogisticsBookingSchema, type CreateLogisticsBookingInput, type PrismVerifiedEventActor } from '@prism/types';
import { LogisticsBookingService } from '../../application/billing/logistics-booking.service';

@Controller('events/:eventId/logistics-bookings')
@UseGuards(EventSessionGuard)
export class LogisticsBookingController {
  constructor(private readonly service: LogisticsBookingService, private readonly access: EventAccessPolicyService) {}

  @Get()
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.list(eventId, this.access.resolveActor({}, verified));
  }

  @Post()
  create(@Param('eventId') eventId: string, @Body(zodBody(createLogisticsBookingSchema)) input: CreateLogisticsBookingInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.create(eventId, input, this.access.resolveActor({}, verified));
  }
}
