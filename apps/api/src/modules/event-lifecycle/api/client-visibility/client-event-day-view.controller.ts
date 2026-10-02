import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  setClientEventDayViewSchema,
  type PrismVerifiedEventActor,
  type SetClientEventDayViewInput,
} from '@prism/types';
import { ClientEventDayViewService } from '../../application/client-visibility/client-event-day-view.service';

@Controller('events')
export class ClientEventDayViewController {
  constructor(
    private readonly clientEventDayViewService: ClientEventDayViewService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Patch(':eventId/client-event-day-view')
  @UseGuards(EventSessionGuard)
  async setClientEventDayView(
    @Param('eventId') eventId: string,
    @Body(zodBody(setClientEventDayViewSchema)) input: SetClientEventDayViewInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    await this.eventAccessPolicyService.requireActorRole(
      actor,
      [OpsUserRole.PmcmAdmin],
      'client event-day visibility',
      eventId,
    );
    return this.clientEventDayViewService.setClientEventDayView(eventId, input, actor);
  }
}
