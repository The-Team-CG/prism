import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { submitBriefingSchema, type PrismVerifiedEventActor, type SubmitBriefingInput } from '@prism/types';
import { mapBriefing } from '../../application/onboarding/inquiry.mappers';
import { ClientOnboardingWorkflowService } from '../../application/onboarding/client-onboarding-workflow.service';

@Controller('events')
export class OpsEventBriefingController {
  constructor(
    private readonly clientOnboardingWorkflowService: ClientOnboardingWorkflowService,
    private readonly eventAccessPolicyService: EventAccessPolicyService,
  ) {}

  @Post(':eventId/briefing')
  @UseGuards(EventSessionGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitBriefing(
    @Param('eventId') eventId: string,
    @Body(zodBody(submitBriefingSchema)) dto: SubmitBriefingInput,
    @VerifiedEventActor() verifiedActor: PrismVerifiedEventActor,
  ) {
    const actor = this.eventAccessPolicyService.resolveActor({}, verifiedActor);
    const briefing = mapBriefing(await this.clientOnboardingWorkflowService.submitBriefing(eventId, dto, actor));
    return {
      eventId: briefing.eventId,
      venue: briefing.venue,
      guestCount: briefing.guestCount,
      budgetRange: briefing.budgetRange,
      serviceRequirements: briefing.serviceRequirements,
      notes: briefing.notes,
      submittedAt: briefing.submittedAt,
    };
  }
}
