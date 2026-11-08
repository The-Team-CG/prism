import { Body, Controller, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import { aiEventRequestSchema, askOperationsAssistantSchema, type AiEventRequest, type AskOperationsAssistantInput, type PrismVerifiedEventActor } from '@prism/types';
import { AiAdvisoryService } from '../../application/ai-governance/ai-advisory.service';

@Controller('ai-advisory')
@UseGuards(EventSessionGuard)
export class AiAdvisoryController {
  constructor(private readonly advisory: AiAdvisoryService) {}

  @Post('compliance')
  @HttpCode(HttpStatus.OK)
  compliance(@Body(zodBody(aiEventRequestSchema)) request: AiEventRequest, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.advisory.complianceAdvisory(request.eventId, verified);
  }

  @Post('themes')
  @HttpCode(HttpStatus.OK)
  themes(@Body(zodBody(aiEventRequestSchema)) request: AiEventRequest, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.advisory.themeSuggestions(request.eventId, verified);
  }

  @Post('event-day-copilot')
  @HttpCode(HttpStatus.OK)
  copilot(@Body(zodBody(aiEventRequestSchema)) request: AiEventRequest, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.advisory.eventDayCopilot(request.eventId, verified);
  }

  @Post('events/:eventId/assistant')
  @HttpCode(HttpStatus.OK)
  assistant(@Param('eventId') eventId: string, @Body(zodBody(askOperationsAssistantSchema)) ask: AskOperationsAssistantInput, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.advisory.askOperationsAssistant(eventId, ask, verified);
  }

  @Post('event-intelligence')
  @HttpCode(HttpStatus.OK)
  intelligence(@Body(zodBody(aiEventRequestSchema)) request: AiEventRequest, @VerifiedEventActor() verified: PrismVerifiedEventActor) {
    return this.advisory.eventIntelligence(request.eventId, verified);
  }
}
