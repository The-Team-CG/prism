import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody, zodQuery } from '@prism/kernel/shared';
import {
  assignEventGameAwardSchema,
  eventGameResponseHistoryQuerySchema,
  gameHostCommandSchema,
  moderateEventGameSchema,
  type PrismAssignEventGameAwardInput,
  type PrismEventGameResponseHistoryQuery,
  type PrismGameHostCommandInput,
  type PrismModerateEventGameInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { GameSessionService } from '../application/game-session.service';
import { GameReadModelService } from '../application/game-read-model.service';
import { GameModerationService } from '../application/game-moderation.service';
import { GameAwardService } from '../application/game-award.service';

@Controller('events')
@UseGuards(EventSessionGuard)
export class GameSessionHostController {
  constructor(
    private readonly sessions: GameSessionService,
    private readonly readModels: GameReadModelService,
    private readonly moderation: GameModerationService,
    private readonly awards: GameAwardService,
  ) {}

  @Post(':eventId/game-sessions/:sessionId/commands')
  executeCommand(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body(zodBody(gameHostCommandSchema)) input: PrismGameHostCommandInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.sessions.executeHostCommand(eventId, sessionId, actor, input);
  }

  @Get(':eventId/game-sessions/:sessionId/host-state')
  getHostState(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.readModels.getHostState(eventId, sessionId, actor);
  }

  @Get(':eventId/game-analytics')
  getEventAnalytics(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.readModels.getEventAnalytics(eventId, actor);
  }

  @Get(':eventId/game-sessions/:sessionId/responses')
  getResponseHistory(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Query(zodQuery(eventGameResponseHistoryQuerySchema)) query: PrismEventGameResponseHistoryQuery,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.readModels.getResponseHistory(eventId, sessionId, actor, query);
  }

  @Post(':eventId/game-sessions/:sessionId/moderation')
  moderate(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body(zodBody(moderateEventGameSchema)) input: PrismModerateEventGameInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.moderation.moderate(eventId, sessionId, actor, input);
  }

  @Post(':eventId/game-sessions/:sessionId/awards')
  assignAward(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body(zodBody(assignEventGameAwardSchema)) input: PrismAssignEventGameAwardInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.awards.assign(eventId, sessionId, actor, input);
  }
}
