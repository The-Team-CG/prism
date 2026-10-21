import { Body, Controller, Get, Inject, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createFileRequirementSchema,
  fileRequirementKeySchema,
  updateFileRequirementSchema,
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
}
