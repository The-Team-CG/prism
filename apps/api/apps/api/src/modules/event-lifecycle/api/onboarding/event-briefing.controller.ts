import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { SubmitBriefingDto } from './inquiry.dto';
import { mapBriefing } from '../../application/onboarding/inquiry.mappers';
import { ClientOnboardingWorkflowService } from '../../application/onboarding/client-onboarding-workflow.service';

@Controller('events')
export class OpsEventBriefingController {
  constructor(private readonly clientOnboardingWorkflowService: ClientOnboardingWorkflowService) {}

  @Post(':eventId/briefing')
  @HttpCode(HttpStatus.CREATED)
  async submitBriefing(@Param('eventId') eventId: string, @Body() dto: SubmitBriefingDto) {
    return mapBriefing(await this.clientOnboardingWorkflowService.submitBriefing(eventId, dto));
  }
}
