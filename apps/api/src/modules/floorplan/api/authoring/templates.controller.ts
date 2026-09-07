import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { CreateTemplateDto } from './create-template.dto';
import { UpdateTemplateDto } from './update-template.dto';
import { TemplatesService } from '../../application/authoring/templates.service';
import { zodBody } from '@prism/kernel/shared';
import { createTemplateSchema, updateTemplateSchema, type CreateTemplateInput, type UpdateTemplateInput } from '@prism/types';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService, private readonly access: EventAccessPolicyService) {}

  private async requireAuthoring(verifiedActor: PrismVerifiedEventActor) {
    const actor = this.access.resolveActor({}, verifiedActor);
    await this.access.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'template authoring');
  }

  @Get()
  @UseGuards(EventSessionGuard)
  async list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireAuthoring(verifiedActor);
    return this.templatesService.listTemplates();
  }

  @Get(':templateId')
  @UseGuards(EventSessionGuard)
  async getOne(@Param('templateId') templateId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireAuthoring(verifiedActor);
    return this.templatesService.getTemplate(templateId);
  }

  @Post()
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body(zodBody(createTemplateSchema)) dto: CreateTemplateInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireAuthoring(verifiedActor);
    return this.templatesService.createTemplate(dto);
  }

  @Patch(':templateId')
  @UseGuards(EventSessionGuard)
  async update(@Param('templateId') templateId: string, @Body(zodBody(updateTemplateSchema)) dto: UpdateTemplateInput, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireAuthoring(verifiedActor);
    return this.templatesService.updateTemplate(templateId, dto);
  }

  @Delete(':templateId')
  @UseGuards(EventSessionGuard)
  async delete(@Param('templateId') templateId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    await this.requireAuthoring(verifiedActor);
    return this.templatesService.deleteTemplate(templateId);
  }
}
