import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { FileRequirementsMatrixService } from '../../application/files/file-requirements-matrix.service';

@Controller('events')
export class OpsEventFileRequirementsController {
  constructor(
    private readonly fileRequirementsMatrixService: FileRequirementsMatrixService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/file-requirements')
  @UseGuards(EventSessionGuard)
  async fileRequirements(@Param('eventId') eventId: string, @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const event = await this.fileRequirementsMatrixService.requireEvent(eventId);

    await this.eventAccessPolicyService.requireCanReadEvent(actor, event, 'file requirements matrix');

    const matrix = await this.fileRequirementsMatrixService.buildForEvent(eventId);
    return {
      ...matrix,
      items: matrix.items.filter((item) => item.visibleToRoles.includes(actor.role)),
    };
  }
}
