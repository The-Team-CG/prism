import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import { submitEventGameActionSchema, type PrismSubmitEventGameActionInput } from '@prism/types';
import { GameActionService } from '../application/game-action.service';
import { GameReadModelService } from '../application/game-read-model.service';
import { GameParticipantGuard } from './game-participant.guard';

@Controller('game-sessions')
@UseGuards(GameParticipantGuard)
export class GameSessionController {
  constructor(
    private readonly actions: GameActionService,
    private readonly readModels: GameReadModelService,
  ) {}

  @Get(':sessionId/state')
  getParticipantState(
    @Param('sessionId') sessionId: string,
    @Headers('x-prism-game-credential') credential: string,
  ) {
    return this.readModels.getParticipantState(sessionId, credential);
  }

  @Get(':sessionId/media/:objectId/download-authorization')
  getParticipantMediaAuthorization(
    @Param('sessionId') sessionId: string,
    @Param('objectId') objectId: string,
    @Headers('x-prism-game-credential') credential: string,
  ) {
    return this.readModels.getParticipantMediaAuthorization(sessionId, objectId, credential);
  }

  @Post(':sessionId/actions')
  submitAction(
    @Param('sessionId') sessionId: string,
    @Headers('x-prism-game-credential') credential: string,
    @Body(zodBody(submitEventGameActionSchema)) input: PrismSubmitEventGameActionInput,
  ) {
    return this.actions.submitAction(sessionId, credential, input);
  }
}
