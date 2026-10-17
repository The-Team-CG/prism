import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventSessionGuard, VerifiedEventActor } from '@prism/kernel/event-session';
import { zodBody } from '@prism/kernel/shared';
import {
  createEventGameSchema,
  createGameSessionSchema,
  confirmStorageUploadSchema,
  requestEventGameLobbyLogoUploadSchema,
  requestEventGameMediaUploadSchema,
  updateEventGameLobbyBrandingSchema,
  updateEventGameSchema,
  type PrismCreateEventGameInput,
  type PrismCreateGameSessionInput,
  type PrismUpdateEventGameInput,
  type UpdateEventGameLobbyBrandingInput,
  type PrismVerifiedEventActor,
  type ConfirmStorageUploadInput,
  type RequestEventGameLobbyLogoUploadInput,
  type RequestEventGameMediaUploadInput,
} from '@prism/types';
import { GameDefinitionService } from '../application/game-definition.service';
import { GameSessionService } from '../application/game-session.service';
import { EventGamesLobbyService } from '../application/game-lobby.service';

@Controller('events')
@UseGuards(EventSessionGuard)
export class EventGamesController {
  constructor(
    private readonly definitions: GameDefinitionService,
    private readonly sessions: GameSessionService,
    private readonly lobbies: EventGamesLobbyService,
  ) {}

  @Get(':eventId/games')
  listForEvent(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.listForEvent(eventId, actor);
  }

  @Post(':eventId/games')
  @HttpCode(HttpStatus.CREATED)
  createDraft(
    @Param('eventId') eventId: string,
    @Body(zodBody(createEventGameSchema)) input: PrismCreateEventGameInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.createDraft(eventId, actor, input);
  }

  @Get(':eventId/games/:gameId')
  getForEvent(
    @Param('eventId') eventId: string,
    @Param('gameId') gameId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.getForEvent(eventId, gameId, actor);
  }

  @Patch(':eventId/games/:gameId')
  updateDraft(
    @Param('eventId') eventId: string,
    @Param('gameId') gameId: string,
    @Body(zodBody(updateEventGameSchema)) input: PrismUpdateEventGameInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.updateDraft(eventId, gameId, actor, input);
  }

  @Delete(':eventId/games/:gameId')
  removeUnstartedGame(
    @Param('eventId') eventId: string,
    @Param('gameId') gameId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.removeUnstartedGame(eventId, gameId, actor);
  }

  @Post(':eventId/games/:gameId/publish')
  publishDraft(
    @Param('eventId') eventId: string,
    @Param('gameId') gameId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.publishDraft(eventId, gameId, actor);
  }

  @Post(':eventId/games/:gameId/media-upload-request')
  @HttpCode(HttpStatus.OK)
  requestGameMediaUpload(
    @Param('eventId') eventId: string,
    @Param('gameId') gameId: string,
    @Body(zodBody(requestEventGameMediaUploadSchema)) input: RequestEventGameMediaUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.requestGameMediaUpload(eventId, gameId, actor, input);
  }

  @Post(':eventId/games/:gameId/media/:objectId/confirm')
  @HttpCode(HttpStatus.OK)
  confirmGameMediaUpload(
    @Param('eventId') eventId: string,
    @Param('gameId') gameId: string,
    @Param('objectId') objectId: string,
    @Body(zodBody(confirmStorageUploadSchema)) input: ConfirmStorageUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.definitions.confirmGameMediaUpload(eventId, gameId, objectId, actor, input);
  }

  @Post(':eventId/games/:gameId/sessions')
  @HttpCode(HttpStatus.CREATED)
  createHostSession(
    @Param('eventId') eventId: string,
    @Param('gameId') gameId: string,
    @Body(zodBody(createGameSessionSchema)) input: PrismCreateGameSessionInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    if (input.gameId !== gameId) {
      throw new BadRequestException('Game id in URL and body must match');
    }
    return this.sessions.createHostSession(eventId, actor, input);
  }

  @Post(':eventId/game-lobby')
  @HttpCode(HttpStatus.OK)
  ensureGameLobby(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.lobbies.ensureLobbySlug(eventId, actor);
  }

  @Get(':eventId/game-lobby/branding')
  getGameLobbyBranding(
    @Param('eventId') eventId: string,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.lobbies.getHostLobbyBranding(eventId, actor);
  }

  @Patch(':eventId/game-lobby/branding')
  updateGameLobbyBranding(
    @Param('eventId') eventId: string,
    @Body(zodBody(updateEventGameLobbyBrandingSchema)) input: UpdateEventGameLobbyBrandingInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.lobbies.updateHostLobbyBranding(eventId, actor, input);
  }

  @Post(':eventId/game-lobby/branding/logo-upload-request')
  @HttpCode(HttpStatus.OK)
  requestGameLobbyLogoUpload(
    @Param('eventId') eventId: string,
    @Body(zodBody(requestEventGameLobbyLogoUploadSchema)) input: RequestEventGameLobbyLogoUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.lobbies.requestLobbyLogoUpload(eventId, actor, input);
  }

  @Post(':eventId/game-lobby/branding/logos/:objectId/confirm')
  @HttpCode(HttpStatus.OK)
  confirmGameLobbyLogoUpload(
    @Param('eventId') eventId: string,
    @Param('objectId') objectId: string,
    @Body(zodBody(confirmStorageUploadSchema)) input: ConfirmStorageUploadInput,
    @VerifiedEventActor() actor: PrismVerifiedEventActor,
  ) {
    return this.lobbies.confirmLobbyLogoUpload(eventId, objectId, actor, input);
  }
}
