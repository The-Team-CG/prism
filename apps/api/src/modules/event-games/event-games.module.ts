import { Module } from '@nestjs/common';
import { AccessControlModule } from '@prism/kernel/access-control';
import { DatabaseModule } from '@prism/kernel/database';
import { EventCoreModule } from '@prism/kernel/event-core';
import { EventSessionModule } from '@prism/kernel/event-session';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';
import { GAME_AUDIT } from './contracts/game-audit.port';
import { GAME_EVENT_ACCESS } from './contracts/game-event-access.port';
import { GAME_PIN_STORE } from './contracts/game-pin-store.port';
import { GAME_DEFINITION_STORE } from './contracts/game-definition-store.port';
import { GAME_SESSION_STORE } from './contracts/game-session-store.port';
import { GAME_LOBBY_STORE } from './contracts/game-lobby-store.port';
import { GAME_PERSISTENCE } from './contracts/game-persistence.port';
import { GAME_RATE_LIMITER } from './contracts/game-rate-limiter.port';
import { GAME_RULES } from './contracts/game-rule.port';
import { GAME_SCHEDULER } from './contracts/game-scheduler.port';
import { GAME_ACTION_CLOCK, GAME_ACTION_STORE } from './contracts/game-action-store.port';
import { GAME_AWARD_STORE } from './contracts/game-award-store.port';
import { GAME_MEDIA_STORAGE } from './contracts/game-media-storage.port';
import { GAME_MODERATION_STORE } from './contracts/game-moderation-store.port';
import { EventGamesHostCommandService } from './application/event-games-host-command.service';
import { EventGamesEventAccessAdapter } from './infrastructure/event-games-event-access.adapter';
import { GameAuditAdapter } from './infrastructure/game-audit.adapter';
import { EventGamesPrismaStoreAdapter } from './infrastructure/event-games-prisma-store.adapter';
import { EventGamesPersistenceAdapter } from './infrastructure/event-games-persistence.adapter';
import { EventGamesLobbyPrismaStoreAdapter } from './infrastructure/event-games-lobby-prisma-store.adapter';
import { GameDefinitionService } from './application/game-definition.service';
import { GameSessionService } from './application/game-session.service';
import { GameScheduledStartWorker } from './application/game-scheduled-start.worker';
import { GameScoringService } from './application/game-scoring.service';
import { GameRuleRegistry } from './application/game-rule-registry';
import { createDefaultGameRuleRegistry } from './application/default-game-rules';
import { EventGamesController } from './api/event-games.controller';
import { GameSessionHostController } from './api/game-session-host.controller';
import { GameSessionJoinController } from './api/game-session-join.controller';
import { GameParticipantGuard } from './api/game-participant.guard';
import { EventGamesLobbyController } from './api/game-lobby.controller';
import { EventGamesLobbyService, GAME_LOBBY_CLOCK } from './application/game-lobby.service';
import { EventGamesSessionJoinService } from './application/game-session-join.service';
import { EventGamesSessionPinService } from './application/game-session-pin.service';
import { EventGamesPinPrismaStoreAdapter } from './infrastructure/event-games-pin-prisma-store.adapter';
import { EventGamesPostgresRateLimiter } from './infrastructure/event-games-postgres-rate-limiter.adapter';
import { GameSessionController } from './api/game-session.controller';
import { GameActionService } from './application/game-action.service';
import { GameReadModelService } from './application/game-read-model.service';
import { GameModerationService } from './application/game-moderation.service';
import { GameAwardService } from './application/game-award.service';
import { EventGamesActionPrismaStoreAdapter } from './infrastructure/event-games-action-prisma-store.adapter';
import { EventGamesModerationPrismaStoreAdapter } from './infrastructure/event-games-moderation-prisma-store.adapter';
import { EventGamesAwardPrismaStoreAdapter } from './infrastructure/event-games-award-prisma-store.adapter';
import { EventGamesMediaStorageAdapter } from './infrastructure/event-games-media-storage.adapter';

@Module({
  controllers: [EventGamesController, GameSessionHostController, GameSessionController, EventGamesLobbyController, GameSessionJoinController],
  imports: [DatabaseModule, AccessControlModule, EventCoreModule, EventSessionModule, PlatformOpsModule],
  providers: [
    EventGamesHostCommandService,
    GameDefinitionService,
    GameSessionService,
    GameScheduledStartWorker,
    EventGamesSessionJoinService,
    GameParticipantGuard,
    GameScoringService,
    GameActionService,
    GameReadModelService,
    GameModerationService,
    GameAwardService,
    { provide: GAME_ACTION_CLOCK, useValue: () => new Date() },
    EventGamesActionPrismaStoreAdapter,
    EventGamesModerationPrismaStoreAdapter,
    EventGamesAwardPrismaStoreAdapter,
    EventGamesMediaStorageAdapter,
    { provide: GameRuleRegistry, useFactory: createDefaultGameRuleRegistry },
    EventGamesSessionPinService,
    EventGamesLobbyService,
    { provide: GAME_LOBBY_CLOCK, useValue: () => new Date() },
    EventGamesEventAccessAdapter,
    GameAuditAdapter,
    EventGamesPrismaStoreAdapter,
    EventGamesPersistenceAdapter,
    EventGamesLobbyPrismaStoreAdapter,
    EventGamesPinPrismaStoreAdapter,
    EventGamesPostgresRateLimiter,
    { provide: GAME_EVENT_ACCESS, useExisting: EventGamesEventAccessAdapter },
    { provide: GAME_AUDIT, useExisting: GameAuditAdapter },
    { provide: GAME_DEFINITION_STORE, useExisting: EventGamesPrismaStoreAdapter },
    { provide: GAME_SESSION_STORE, useExisting: EventGamesPrismaStoreAdapter },
    { provide: GAME_LOBBY_STORE, useExisting: EventGamesLobbyPrismaStoreAdapter },
    { provide: GAME_PERSISTENCE, useExisting: EventGamesPersistenceAdapter },
    { provide: GAME_PIN_STORE, useExisting: EventGamesPinPrismaStoreAdapter },
    { provide: GAME_RATE_LIMITER, useExisting: EventGamesPostgresRateLimiter },
    { provide: GAME_RULES, useExisting: GameRuleRegistry },
    { provide: GAME_SCHEDULER, useExisting: GameScheduledStartWorker },
    { provide: GAME_ACTION_STORE, useExisting: EventGamesActionPrismaStoreAdapter },
    { provide: GAME_MODERATION_STORE, useExisting: EventGamesModerationPrismaStoreAdapter },
    { provide: GAME_AWARD_STORE, useExisting: EventGamesAwardPrismaStoreAdapter },
    { provide: GAME_MEDIA_STORAGE, useExisting: EventGamesMediaStorageAdapter },
  ],
  exports: [EventGamesHostCommandService, GameDefinitionService, GameSessionService, EventGamesLobbyService, GAME_EVENT_ACCESS, GAME_AUDIT],
})
export class EventGamesModule {}
