import { Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createPlanningTemplateSchema,
  publishPlanningTemplateVersionSchema,
  type CreatePlanningTemplateInput,
  type PrismVerifiedEventActor,
  type PublishPlanningTemplateVersionInput,
} from '@prism/types';
import { PlanningTemplatesService } from '../../application/planning/planning-templates.service';

/** Planning templates belong to PMCM. Every route is PMCM admin or system; no event scope applies. */
@Controller('planning-templates')
@UseGuards(EventSessionGuard)
export class PlanningTemplatesController {
  constructor(
    private readonly templates: PlanningTemplatesService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get()
  async list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requirePmcm(verifiedActor, 'planning templates');
    return this.templates.list();
  }

  @Get(':templateId')
  async get(@Param('templateId') templateId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requirePmcm(verifiedActor, 'planning template');
    return this.templates.get(templateId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(zodBody(createPlanningTemplateSchema)) dto: CreatePlanningTemplateInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.templates.create(dto, await this.requirePmcm(verifiedActor, 'planning template creation'));
  }

  @Post(':templateId/versions')
  @HttpCode(HttpStatus.CREATED)
  async publishVersion(
    @Param('templateId') templateId: string,
    @Body(zodBody(publishPlanningTemplateVersionSchema)) dto: PublishPlanningTemplateVersionInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    return this.templates.publishVersion(templateId, dto, await this.requirePmcm(verifiedActor, 'planning template version'));
  }

  @Post(':templateId/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('templateId') templateId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.templates.setArchived(templateId, true, await this.requirePmcm(verifiedActor, 'planning template archive'));
  }

  @Post(':templateId/restore')
  @HttpCode(HttpStatus.OK)
  async restore(@Param('templateId') templateId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.templates.setArchived(templateId, false, await this.requirePmcm(verifiedActor, 'planning template restore'));
  }

  private async requirePmcm(verifiedActor: PrismVerifiedEventActor, resource: string) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], resource);
    if (!actor.id?.trim()) throw new ForbiddenException('Verified actor ID is required');
    return { id: actor.id, name: actor.name, role: actor.role, email: actor.email };
  }
}
