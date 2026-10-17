import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { zodBody } from '@prism/kernel/shared';
import {
  joinActiveMultiplayerGameSessionSchema,
  type PrismJoinActiveMultiplayerGameSessionInput,
} from '@prism/types';
import { EventGamesSessionJoinService } from '../application/game-session-join.service';

type JoinRequest = { ip?: string };

@Controller('game-sessions')
export class GameSessionJoinController {
  constructor(private readonly joins: EventGamesSessionJoinService) {}

  @Post('join')
  @HttpCode(HttpStatus.OK)
  join(
    @Body(zodBody(joinActiveMultiplayerGameSessionSchema)) input: PrismJoinActiveMultiplayerGameSessionInput,
    @Headers('x-prism-game-credential') retainedCredential: string | undefined,
    @Req() request: JoinRequest,
  ) {
    return this.joins.joinActiveMultiplayerSession(input, retainedCredential, request.ip || 'unknown');
  }
}
