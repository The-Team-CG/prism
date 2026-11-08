import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createAccreditationRequirementSchema,
  updateAccreditationRequirementSchema,
  type CreateAccreditationRequirementInput,
  type PrismVerifiedEventActor,
  type UpdateAccreditationRequirementInput,
} from '@prism/types';
import { AccreditationService } from '../../application/compliance/accreditation.service';

@Controller('events/:eventId/accreditation')
@UseGuards(EventSessionGuard)
export class AccreditationController {
  constructor(private readonly service: AccreditationService, private readonly access: EventAccessPolicyService) {}

  @Get()
  list(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.list(eventId, this.access.resolveActor({}, verified));
  }

  @Post()
  create(@Param('eventId') eventId: string, @Body(zodBody(createAccreditationRequirementSchema)) input: CreateAccreditationRequirementInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.create(eventId, input, this.access.resolveActor({}, verified));
  }

  @Patch(':requirementId')
  update(@Param('eventId') eventId: string, @Param('requirementId') requirementId: string, @Body(zodBody(updateAccreditationRequirementSchema)) input: UpdateAccreditationRequirementInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.update(eventId, requirementId, input, this.access.resolveActor({}, verified));
  }
}
