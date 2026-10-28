import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createFileRequirementSchema,
  bindFileRequirementUploadSchema,
  fileRequirementKeySchema,
  updateFileRequirementSchema,
  type UpsertFileRequirementTemplateInput,
  upsertFileRequirementTemplateSchema,
  type CreateFileRequirementInput,
  type PrismVerifiedEventActor,
  type UpdateFileRequirementInput,
} from '@prism/types';
import { scopeActorToEvent } from '@prism/contexts/read-models/event-scope';
import { FileRequirementsMatrixService } from '../../application/files/file-requirements-matrix.service';
import { FILE_REQUIREMENT_COMMANDS } from '../../contracts/file-ops.tokens';
import type { FileRequirementCommands } from '../../contracts/file-requirement-commands.port';
import { visibleFileRequirementItems } from '../../domain/file-requirement-matrix.policy';

@Controller('events')
export class OpsEventFileRequirementsController {
  constructor(
    private readonly fileRequirementsMatrixService: FileRequirementsMatrixService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
    @Inject(FILE_REQUIREMENT_COMMANDS) private readonly fileRequirementCommands: FileRequirementCommands,
  ) {}

  @Get(':eventId/file-requirements')
  @UseGuards(EventSessionGuard)
  async fileRequirements(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const event = await this.fileRequirementsMatrixService.requireEvent(eventId);
    const scoped = scopeActorToEvent(actor, event);
    await this.eventAccessPolicyService.requireCanReadEvent(scoped.actor, event, 'file requirements matrix', scoped.scope);

    const matrix = await this.fileRequirementsMatrixService.buildForEvent(eventId);
    return { ...matrix, items: visibleFileRequirementItems(matrix.items, actor.role) };
  }

  @Post(':eventId/file-requirements')
  @UseGuards(EventSessionGuard)
  createFileRequirement(
    @Param('eventId') eventId: string,
    @Body(zodBody(createFileRequirementSchema)) input: CreateFileRequirementInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.fileRequirementCommands.createRequirement(eventId, input, actor);
  }

  @Patch(':eventId/file-requirements/:key')
  @UseGuards(EventSessionGuard)
  updateFileRequirement(
    @Param('eventId') eventId: string,
    @Param('key') key: string,
    @Body(zodBody(updateFileRequirementSchema)) input: UpdateFileRequirementInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const parsedKey = fileRequirementKeySchema.safeParse(key);
    if (!parsedKey.success) throw new NotFoundException('File requirement not found');
    return this.fileRequirementCommands.updateRequirement(eventId, parsedKey.data, input, actor);
  }

  @Post(':eventId/file-requirements/reminders')
  @UseGuards(EventSessionGuard)
  sendFileRequirementReminders(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.fileRequirementCommands.sendReminders(eventId, actor);
  }

  @Post(':eventId/file-requirements/apply-template')
  @UseGuards(EventSessionGuard)
  applyFileRequirementTemplate(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.fileRequirementCommands.applyRequirementTemplate(eventId, actor);
  }

  @Post(':eventId/file-requirements/:key/upload')
  @UseGuards(EventSessionGuard)
  bindFileRequirementUpload(
    @Param('eventId') eventId: string,
    @Param('key') key: string,
    @Body(zodBody(bindFileRequirementUploadSchema)) input: import('@prism/types').BindFileRequirementUploadInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const parsedKey = fileRequirementKeySchema.safeParse(key);
    if (!parsedKey.success) throw new NotFoundException('File requirement not found');
    return this.fileRequirementCommands.bindRequirementUpload(eventId, parsedKey.data, input, actor);
  }
}

@Controller('file-requirement-templates')
export class FileRequirementTemplatesController {
  constructor(@Inject(FILE_REQUIREMENT_COMMANDS) private readonly fileRequirementCommands: FileRequirementCommands,
    private readonly eventAccessPolicyService: EventAccessPolicyService) {}

  @Get()
  @UseGuards(EventSessionGuard)
  list(@VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.fileRequirementCommands.listRequirementTemplates(this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }

  @Post()
  @UseGuards(EventSessionGuard)
  upsert(@Body(zodBody(upsertFileRequirementTemplateSchema)) input: UpsertFileRequirementTemplateInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    return this.fileRequirementCommands.upsertRequirementTemplate(input, this.eventAccessPolicyService.resolveActor({}, verifiedActor));
  }
}
