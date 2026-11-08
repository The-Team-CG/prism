import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  chooseVenueScoutingPreferenceSchema,
  createVenueScoutingOptionSchema,
  type ChooseVenueScoutingPreferenceInput,
  type CreateVenueScoutingOptionInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { VenueScoutingService } from '../../application/quotes/venue-scouting.service';

@Controller('events/:eventId/venue-scouting')
@UseGuards(EventSessionGuard)
export class VenueScoutingController {
  constructor(private readonly service: VenueScoutingService, private readonly access: EventAccessPolicyService) {}

  @Get()
  get(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.get(eventId, this.access.resolveActor({}, verified));
  }

  @Post('options')
  addOption(@Param('eventId') eventId: string, @Body(zodBody(createVenueScoutingOptionSchema)) input: CreateVenueScoutingOptionInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.addOption(eventId, input, this.access.resolveActor({}, verified));
  }

  @Post('options/:optionId/withdraw')
  withdraw(@Param('eventId') eventId: string, @Param('optionId') optionId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.withdraw(eventId, optionId, this.access.resolveActor({}, verified));
  }

  @Post('publish')
  publish(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.publish(eventId, this.access.resolveActor({}, verified));
  }

  @Post('preference')
  choosePreference(@Param('eventId') eventId: string, @Body(zodBody(chooseVenueScoutingPreferenceSchema)) input: ChooseVenueScoutingPreferenceInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.choosePreference(eventId, input, this.access.resolveActor({}, verified));
  }
}
