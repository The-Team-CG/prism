import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { zodBody } from '@prism/kernel/shared';
import { startIndependentSingleplayerGameSessionSchema, type PrismStartIndependentSingleplayerGameInput } from '@prism/types';
import { EventGamesLobbyService } from '../application/game-lobby.service';

/** Public, anonymous routes for the event games lobby and Independent games. */
@Controller('game-lobbies')
export class EventGamesLobbyController {
  constructor(private readonly lobbies: EventGamesLobbyService) {}

  @Get(':eventSlug')
  getPublicLobby(@Param('eventSlug') eventSlug: string, @Req() request: Request) {
    return this.lobbies.getPublicLobby(eventSlug, request.socket.remoteAddress ?? '');
  }

  @Post(':eventSlug/games/:gameId/sessions')
  @HttpCode(HttpStatus.CREATED)
  startIndependentGame(
    @Param('eventSlug') eventSlug: string,
    @Param('gameId') gameId: string,
    @Body(zodBody(startIndependentSingleplayerGameSessionSchema)) input: PrismStartIndependentSingleplayerGameInput,
    @Req() request: Request,
  ) {
    return this.lobbies.startIndependentGame(eventSlug, gameId, input, request.socket.remoteAddress ?? '');
  }
}
