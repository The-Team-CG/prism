import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createRegistrationPlatformSchema,
  importHeadcountSchema,
  updateRegistrationPlatformSchema,
  type CreateRegistrationPlatformInput,
  type ImportHeadcountInput,
  type PrismVerifiedEventActor,
  type UpdateRegistrationPlatformInput,
} from '@prism/types';
import { RegistrationPlatformService } from '../../application/guest/registration-platform.service';

const PMCM_ROLES = [OpsUserRole.PmcmAdmin, OpsUserRole.System] as const;

@Controller('events/:eventId/registration-platform')
export class OpsRegistrationPlatformController {
  constructor(
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    private readonly registrationPlatformService: RegistrationPlatformService,
  ) {}

  @Get()
  @UseGuards(EventSessionGuard)
  async get(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requirePmcm(verifiedActor, eventId);
    const platform = await this.registrationPlatformService.getByEventId(eventId);
    return platform ? this.registrationPlatformService.mapRegistrationPlatform(platform) : null;
  }

  @Post()
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async upsert(
    @Param('eventId') eventId: string,
    @Body(zodBody(createRegistrationPlatformSchema)) input: CreateRegistrationPlatformInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    const platform = await this.registrationPlatformService.upsert(eventId, input, actor);
    return this.registrationPlatformService.mapRegistrationPlatform(platform);
  }

  @Patch()
  @UseGuards(EventSessionGuard)
  async update(
    @Param('eventId') eventId: string,
    @Body(zodBody(updateRegistrationPlatformSchema)) input: UpdateRegistrationPlatformInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    const platform = await this.registrationPlatformService.update(eventId, input, actor);
    return this.registrationPlatformService.mapRegistrationPlatform(platform);
  }

  @Post('headcount-import')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async importHeadcount(
    @Param('eventId') eventId: string,
    @Body(zodBody(importHeadcountSchema)) input: ImportHeadcountInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = await this.requirePmcm(verifiedActor, eventId);
    const platform = await this.registrationPlatformService.importHeadcount(eventId, input, actor);
    return this.registrationPlatformService.mapRegistrationPlatform(platform);
  }

  private requirePmcm(verifiedActor: PrismVerifiedEventActor, eventId: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.eventAccessPolicyService
      .requireActorRole(actor, [...PMCM_ROLES], 'registration platform', eventId)
      .then(() => actor);
  }
}
