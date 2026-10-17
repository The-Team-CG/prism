import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { PrismTransactionRunner, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
import {
  eventGameLobbyBrandingSettingsSchema,
  PRISM_EVENT_GAME_BRAND_THEMES,
  type PrismEventGameHostLobbyBranding,
  type PrismEventGameLobbyLogoUploadTicket,
  type PrismEventGameBrandTheme,
  type PrismEventGameLobbyBranding,
  type PrismIndependentGameSessionStart,
  type PrismStartIndependentSingleplayerGameInput,
  type PrismVerifiedEventActor,
  type RequestEventGameLobbyLogoUploadInput,
  type UpdateEventGameLobbyBrandingInput,
} from '@prism/types';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import {
  GAME_LOBBY_STORE,
  type ExistingIndependentGameStartRecord,
  type GameLobbyBrandingRecord,
  type GameLobbyStorePort,
  type PublicIndependentGameRecord,
} from '../contracts/game-lobby-store.port';
import { GAME_MEDIA_STORAGE, type GameMediaStoragePort } from '../contracts/game-media-storage.port';
import { GAME_RULES, type GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GAME_RATE_LIMITER, type GameRateLimiterPort } from '../contracts/game-rate-limiter.port';
import { EventGamesHostCommandService } from './event-games-host-command.service';

export const GAME_LOBBY_CLOCK = Symbol('GAME_LOBBY_CLOCK');

/** Public event lobby and Independent (Singleplayer) entry workflow. */
@Injectable()
export class EventGamesLobbyService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_LOBBY_STORE) private readonly store: GameLobbyStorePort,
    @Optional() @Inject(GAME_RULES) private readonly rules: GameRuleRegistryPort | undefined,
    private readonly transactions: PrismTransactionRunner,
    @Inject(GAME_LOBBY_CLOCK) private readonly now: () => Date,
    @Optional() @Inject(GAME_RATE_LIMITER) private readonly rateLimiter: GameRateLimiterPort | undefined,
    private readonly configService: ConfigService,
    private readonly hostCommands: EventGamesHostCommandService,
    @Optional() @Inject(GAME_MEDIA_STORAGE) private readonly mediaStorage: GameMediaStoragePort | undefined,
  ) {}

  async getPublicLobby(eventSlug: string, requestSourceAddress: string) {
    const rateLimiter = this.rateLimiter;
    if (!rateLimiter) throw new ServiceUnavailableException('Public game lobby rate limiting is not configured');
    const rateLimit = await rateLimiter.consume({
      action: 'lobby_read',
      sourceFingerprint: this.rateLimitFingerprint(requestSourceAddress, 'global:lobby-read'),
      globalBudgetKey: 'event-game:public-lobby-read',
    });
    if (!rateLimit.allowed) {
      throw new HttpException({ message: 'Too many game lobby requests. Please try again later.', retryAfterSeconds: rateLimit.retryAfterSeconds }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const eventId = await this.transactions.run(
      (transaction) => this.store.findEventIdForLobbySlug(eventSlug, transaction),
      { actorId: 'public-game-lobby' },
    );
    if (!eventId) throw new NotFoundException('Game lobby not found');
    const eventRateLimit = await rateLimiter.consume({
      action: 'lobby_read',
      eventId,
      sourceFingerprint: this.rateLimitFingerprint(requestSourceAddress, `event:${eventId}:lobby-read`),
      globalBudgetKey: `event:${eventId}:lobby-read`,
    });
    if (!eventRateLimit.allowed) {
      throw new HttpException({
        message: 'Too many game lobby requests. Please try again later.',
        retryAfterSeconds: eventRateLimit.retryAfterSeconds,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return this.transactions.run(async (transaction) => {
      const event = await this.eventAccess.getPublicEventScope(eventId, transaction);
      if (!event || event.eventId !== eventId || event.archived || event.closed) throw new NotFoundException('Game lobby not found');
      const games = await this.store.listPublicIndependentGames(eventId, transaction);
      const now = this.now();
      const branding = await this.store.findLobbyBranding(eventId, transaction);
      return {
        eventId,
        eventSlug,
        eventName: event.eventName,
        branding: await this.toLobbyBranding(eventId, branding, transaction),
        games: games
          .filter((game) => game.status === 'published' && game.entryMode === 'independent' && !game.archivedAt)
          .filter((game) => (!game.availableFrom || game.availableFrom <= now) && (!game.availableUntil || now < game.availableUntil))
          .map((game) => ({
            id: game.id,
            title: game.title,
            kind: game.kind,
            availableFrom: game.availableFrom?.toISOString() ?? null,
            availableUntil: game.availableUntil?.toISOString() ?? null,
          })),
      };
    }, { actorId: 'public-game-lobby' });
  }

  async ensureLobbySlug(eventId: string, actor: PrismVerifiedEventActor) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    const event = await this.transactions.run(
      (transaction) => this.eventAccess.getPublicEventScope(eventId, transaction),
      { actorId: actor.actorId },
    );
    if (!event || event.eventId !== eventId) throw new NotFoundException('Event not found');
    if (event.archived || event.closed) throw new ConflictException('Closed events cannot publish a game lobby');
    const lobbySlug = this.deriveOpaqueValue('lobby-slug', eventId);
    const persisted = await this.hostCommands.executeHostCommand({
      eventId,
      actor,
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'provision_lobby',
      command: { lobbySlug },
      requestReceiptId: `provision-game-lobby:${eventId}:${lobbySlug}`,
    });
    return { eventSlug: persisted.resultId };
  }

  async getHostLobbyBranding(eventId: string, actor: PrismVerifiedEventActor): Promise<PrismEventGameHostLobbyBranding> {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      const event = await this.eventAccess.getPublicEventScope(eventId, transaction);
      if (!event || event.eventId !== eventId) throw new NotFoundException('Event not found');
      const branding = await this.store.findLobbyBranding(eventId, transaction);
      return {
        ...await this.toLobbyBranding(eventId, branding, transaction),
        logoObjectId: branding?.logoObjectId ?? null,
      };
    }, { actorId: actor.actorId });
  }

  async updateHostLobbyBranding(
    eventId: string,
    actor: PrismVerifiedEventActor,
    input: UpdateEventGameLobbyBrandingInput,
  ): Promise<PrismEventGameHostLobbyBranding> {
    await this.ensureLobbySlug(eventId, actor);
    const current = await this.transactions.run(
      (transaction) => this.store.findLobbyBranding(eventId, transaction),
      { actorId: actor.actorId },
    );
    const theme = input.theme as PrismEventGameBrandTheme;
    const palette = PRISM_EVENT_GAME_BRAND_THEMES[theme];
    const settings = eventGameLobbyBrandingSettingsSchema.parse({
      theme,
      primaryColor: input.primaryColor ?? palette.primaryColor,
      secondaryColor: input.secondaryColor ?? palette.secondaryColor,
      logoObjectId: input.logoObjectId === undefined ? current?.logoObjectId ?? null : input.logoObjectId,
    });
    if (settings.logoObjectId) {
      if (!this.mediaStorage) throw new ServiceUnavailableException('Event game lobby logo storage is not configured');
      await this.mediaStorage.validateLobbyLogoReference({ eventId, objectId: settings.logoObjectId });
    }
    await this.hostCommands.executeHostCommand({
      eventId,
      actor,
      resourceType: 'lobby',
      resourceId: eventId,
      action: 'update_lobby_branding',
      command: settings,
      requestReceiptId: `update-game-lobby-branding:${eventId}:${input.idempotencyKey}`,
    });
    return this.getHostLobbyBranding(eventId, actor);
  }

  async requestLobbyLogoUpload(
    eventId: string,
    actor: PrismVerifiedEventActor,
    request: RequestEventGameLobbyLogoUploadInput,
  ): Promise<PrismEventGameLobbyLogoUploadTicket> {
    await this.ensureLobbySlug(eventId, actor);
    if (!this.mediaStorage) throw new ServiceUnavailableException('Event game lobby logo storage is not configured');
    return this.mediaStorage.requestLobbyLogoUpload({ eventId, actor, request });
  }

  async confirmLobbyLogoUpload(
    eventId: string,
    objectId: string,
    actor: PrismVerifiedEventActor,
    confirmation: { checksumSha256: string; byteSize: number },
  ): Promise<{ objectId: string }> {
    await this.eventAccess.assertHostAccess(eventId, actor);
    const event = await this.transactions.run(
      (transaction) => this.eventAccess.getPublicEventScope(eventId, transaction),
      { actorId: actor.actorId },
    );
    if (!event || event.eventId !== eventId) throw new NotFoundException('Event not found');
    if (event.archived || event.closed) throw new ConflictException('Closed events cannot update lobby branding');
    if (!this.mediaStorage) throw new ServiceUnavailableException('Event game lobby logo storage is not configured');
    return this.mediaStorage.confirmLobbyLogoUpload({ eventId, objectId, actor, confirmation });
  }

  private async toLobbyBranding(
    eventId: string,
    settings: GameLobbyBrandingRecord | null,
    transaction: PrismTransactionContext,
  ): Promise<PrismEventGameLobbyBranding> {
    const theme = settings?.theme ?? 'prism';
    let logoUrl: string | null = null;
    if (settings?.logoObjectId) {
      if (!this.mediaStorage) throw new ServiceUnavailableException('Event game lobby logo storage is not configured');
      const authorization = await this.mediaStorage.issueLobbyLogoDownloadAuthorization(
        { eventId, objectId: settings.logoObjectId }, transaction,
      );
      logoUrl = authorization.downloadUrl;
    }
    return {
      theme,
      primaryColor: settings?.primaryColor ?? PRISM_EVENT_GAME_BRAND_THEMES[theme].primaryColor,
      secondaryColor: settings?.secondaryColor ?? PRISM_EVENT_GAME_BRAND_THEMES[theme].secondaryColor,
      logoUrl,
    };
  }

  async startIndependentGame(
    eventSlug: string,
    gameId: string,
    input: PrismStartIndependentSingleplayerGameInput,
    requestSourceAddress: string,
  ): Promise<PrismIndependentGameSessionStart> {
    const rateLimiter = this.rateLimiter;
    if (!rateLimiter) throw new ServiceUnavailableException('This game type is not ready to start');
    const globalRateLimit = await rateLimiter.consume({
      action: 'lobby_start',
      sourceFingerprint: this.rateLimitFingerprint(requestSourceAddress, 'global:lobby-start'),
      globalBudgetKey: 'event-game:public-lobby-start',
    });
    if (!globalRateLimit.allowed) {
      throw new HttpException({
        message: 'Too many game start attempts. Please try again later.',
        retryAfterSeconds: globalRateLimit.retryAfterSeconds,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const eventId = await this.transactions.run(
      (transaction) => this.store.findEventIdForLobbySlug(eventSlug, transaction),
      { actorId: 'public-game-lobby' },
    );
    if (!eventId) throw new NotFoundException('Game lobby not found');
    const eventRateLimit = await rateLimiter.consume({
      eventId,
      action: 'lobby_start',
      sourceFingerprint: this.rateLimitFingerprint(requestSourceAddress, `event:${eventId}:lobby-start`),
      globalBudgetKey: `event:${eventId}:lobby-start`,
    });
    if (!eventRateLimit.allowed) {
      throw new HttpException({
        message: 'Too many game start attempts. Please try again later.',
        retryAfterSeconds: eventRateLimit.retryAfterSeconds,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return this.transactions.run(
      (transaction) => this.startInTransaction(eventId, gameId, input, transaction),
      { actorId: 'anonymous-game-participant' },
    );
  }

  private async startInTransaction(
    eventId: string,
    gameId: string,
    input: PrismStartIndependentSingleplayerGameInput,
    transaction: PrismTransactionContext,
  ): Promise<PrismIndependentGameSessionStart> {
    const event = await this.eventAccess.getPublicEventScope(eventId, transaction);
    if (!event || event.eventId !== eventId || event.archived || event.closed) {
      throw new NotFoundException('Game lobby not found');
    }
    if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new NotFoundException('Game lobby not found');
    const participantCredential = input.participantCredential
      ?? this.deriveOpaqueValue('participant-credential', eventId, gameId, input.idempotencyKey);
    const tokenDigest = createHash('sha256').update(participantCredential).digest('hex');
    const idempotencyDigest = this.deriveOpaqueValue('singleplayer-start-idempotency', eventId, input.idempotencyKey);
    const existing = await this.store.findExistingIndependentStart({ eventId, idempotencyKey: idempotencyDigest }, transaction);
    const replay = this.mapExistingStart(existing, eventId, gameId, tokenDigest, participantCredential);
    if (replay) return replay;

    await this.getEligibleGame(eventId, gameId, transaction);
    const started = await this.store.createIndependentSessionAndGrant({
      eventId,
      gameId,
      idempotencyKey: idempotencyDigest,
      tokenDigest,
      credentialId: randomUUID(),
      createCredential: input.participantCredential === undefined,
      sessionId: randomUUID(),
      grantId: randomUUID(),
    }, transaction);
    return {
      eventId,
      sessionId: started.sessionId,
      game: { title: started.title, kind: started.kind },
      status: started.status,
      participantCredential,
    };
  }

  private mapExistingStart(
    existing: ExistingIndependentGameStartRecord | null,
    eventId: string,
    gameId: string,
    tokenDigest: string,
    participantCredential: string,
  ): PrismIndependentGameSessionStart | null {
    if (!existing) return null;
    if (!existing.tokenDigest) throw new ForbiddenException('Participant credential is not valid for this event');
    if (existing.eventId !== eventId || existing.gameId !== gameId || existing.tokenDigest !== tokenDigest) {
      throw new ConflictException('This start key was already used for a different game or participant');
    }
    if (existing.status !== 'live') throw new ConflictException('The Independent game session is no longer available');
    return {
      eventId,
      sessionId: existing.sessionId,
      game: { title: existing.title, kind: existing.kind },
      status: 'live',
      participantCredential,
    };
  }

  private async getEligibleGame(
    eventId: string,
    gameId: string,
    transaction: PrismTransactionContext,
  ): Promise<PublicIndependentGameRecord> {
    const game = this.requirePublishedIndependentGame(
      await this.store.findPublishedIndependentGame({ eventId, gameId }, transaction),
      eventId,
      gameId,
    );
    this.assertGameIsAvailable(game, this.now());
    this.assertGameConfigurationIsReady(game);
    return game;
  }

  private requirePublishedIndependentGame(
    game: PublicIndependentGameRecord | null,
    eventId: string,
    gameId: string,
  ): PublicIndependentGameRecord {
    if (!game || game.eventId !== eventId || game.id !== gameId || game.status !== 'published' || game.entryMode !== 'independent' || game.archivedAt) {
      throw new NotFoundException('Independent game not found');
    }
    return game;
  }

  private assertGameIsAvailable(game: PublicIndependentGameRecord, now: Date): void {
    if ((game.availableFrom && now < game.availableFrom) || (game.availableUntil && now >= game.availableUntil)) {
      throw new ForbiddenException('This game is outside its available event window');
    }
  }

  private assertGameConfigurationIsReady(game: PublicIndependentGameRecord): void {
    const rule = this.rules?.get(game.kind);
    if (!rule) throw new ServiceUnavailableException('This game type is not ready to start');
    if (rule.validateConfiguration(game.config ?? {}).length > 0) {
      throw new ConflictException('Game configuration is incomplete');
    }
  }

  private deriveOpaqueValue(purpose: string, ...scope: string[]): string {
    return createHmac('sha256', this.sessionSecret())
      .update(['prism', 'event-games', purpose, 'v1', ...scope].join('\0'))
      .digest('base64url');
  }

  private rateLimitFingerprint(requestSourceAddress: string, scope: string): string {
    const address = requestSourceAddress.trim();
    if (!address || isIP(address) === 0) {
      throw new ServiceUnavailableException('Trusted request source is unavailable');
    }
    return createHmac('sha256', this.sessionSecret())
      .update(['prism', 'event-games', 'rate-limit-source', 'v1', scope, address].join('\0'))
      .digest('hex');
  }

  private sessionSecret(): string {
    const configured = this.configService.get<string>('PRISM_SESSION_SECRET') ?? this.configService.get<string>('JWT_SECRET');
    if (configured && configured.length >= 32) return configured;

    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? process.env.NODE_ENV;
    const allowLocalSecret = nodeEnv !== 'production'
      && (nodeEnv === 'test' || nodeEnv === 'development' || this.configService.get<string>('PRISM_ALLOW_LOCAL_SESSION_SECRET') === '1');
    if (allowLocalSecret) return 'prism-local-event-game-credential-secret';

    throw new ServiceUnavailableException('Event game credentials are not configured');
  }
}
