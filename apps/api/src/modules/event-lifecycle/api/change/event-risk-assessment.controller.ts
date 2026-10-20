import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { recordEventRiskAssessmentSchema, type PrismVerifiedEventActor, type RecordEventRiskAssessmentInput } from '@prism/types';
import { EventRiskAssessmentService } from '../../application/change/event-risk-assessment.service';

@Controller('events/:eventId/risk-assessment')
@UseGuards(EventSessionGuard)
export class EventRiskAssessmentController {
  constructor(private readonly service: EventRiskAssessmentService, private readonly access: EventAccessPolicyService) {}

  @Get()
  getAssessment(@Param('eventId') eventId: string, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.getAssessment(eventId, this.access.resolveActor({}, verified));
  }

  @Post()
  recordAssessment(@Param('eventId') eventId: string, @Body(zodBody(recordEventRiskAssessmentSchema)) input: RecordEventRiskAssessmentInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.service.recordAssessment(eventId, input, this.access.resolveActor({}, verified));
  }
}
