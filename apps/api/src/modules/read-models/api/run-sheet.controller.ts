import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { RunSheetReadModelsService } from '../application/services/run-sheet-read-models.service';

@Controller('events')
export class OpsRunSheetController {
  constructor(
    private readonly runSheetService: RunSheetReadModelsService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Get(':eventId/run-sheet')
  @UseGuards(EventSessionGuard)
  runSheet(
    @Param('eventId') eventId: string,
    @Query('dayId') dayId: string | undefined,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    return this.runSheetService.getRunSheet(eventId, dayId?.trim() || undefined, actor);
  }
}
