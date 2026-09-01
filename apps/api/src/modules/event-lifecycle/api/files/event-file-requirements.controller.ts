import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { FileRequirementsActorDto } from './file-requirements.dto';
import { FileRequirementsMatrixService } from '../../application/files/file-requirements-matrix.service';

@Controller('events')
export class OpsEventFileRequirementsController {
  constructor(
    private readonly fileRequirementsMatrixService: FileRequirementsMatrixService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/file-requirements')
  async fileRequirements(@Param('eventId') eventId: string, @Query() actorInput: FileRequirementsActorDto) {
    const actor = this.eventAccessPolicyService.resolveActor(actorInput);
    const event = await this.fileRequirementsMatrixService.requireEvent(eventId);

    await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'file requirements matrix');

    const matrix = await this.fileRequirementsMatrixService.buildForEvent(eventId);
    return {
      ...matrix,
      items: matrix.items.filter((item) => item.visibleToRoles.includes(actor.role)),
    };
  }
}
