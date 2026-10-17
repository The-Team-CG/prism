import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { EventSessionModule } from '@prism/kernel/event-session';
import { EventGamesSessionJoinService } from './application/game-session-join.service';
import { EventGamesSessionPinService } from './application/game-session-pin.service';
import { EventGamesHostCommandService } from './application/event-games-host-command.service';
import { GameScheduledStartWorker } from './application/game-scheduled-start.worker';
import { GAME_SCHEDULER } from './contracts/game-scheduler.port';
import { GAME_ACTION_CLOCK } from './contracts/game-action-store.port';
import { GAME_EVENT_ACCESS } from './contracts/game-event-access.port';
import { GAME_PIN_STORE } from './contracts/game-pin-store.port';
import { GAME_RATE_LIMITER } from './contracts/game-rate-limiter.port';
import { EventGamesModule } from './event-games.module';
import { EventGamesPostgresRateLimiter } from './infrastructure/event-games-postgres-rate-limiter.adapter';
import { GameParticipantGuard } from './api/game-participant.guard';
import { GameSessionJoinController } from './api/game-session-join.controller';
import { GAME_MEDIA_STORAGE } from './contracts/game-media-storage.port';
import { EventGamesMediaStorageAdapter } from './infrastructure/event-games-media-storage.adapter';
import { PlatformOpsModule } from '../platform-ops/platform-ops.module';

@Module({
  providers: [
    EventGamesSessionJoinService,
    { provide: GAME_EVENT_ACCESS, useValue: {} },
    { provide: GAME_PIN_STORE, useValue: {} },
    { provide: PrismTransactionRunner, useValue: {} },
    { provide: GAME_RATE_LIMITER, useValue: {} },
    { provide: ConfigService, useValue: {} },
    { provide: GAME_ACTION_CLOCK, useValue: () => new Date() },
  ],
})
class EventGamesSessionJoinTestModule {}

@Module({
  providers: [
    EventGamesSessionPinService,
    { provide: GAME_EVENT_ACCESS, useValue: {} },
    { provide: GAME_PIN_STORE, useValue: {} },
    { provide: EventGamesHostCommandService, useValue: {} },
    { provide: PrismTransactionRunner, useValue: {} },
    { provide: ConfigService, useValue: {} },
    { provide: GAME_ACTION_CLOCK, useValue: () => new Date() },
  ],
})
class EventGamesSessionPinTestModule {}

@Module({
  providers: [
    EventGamesPostgresRateLimiter,
    { provide: PrismTransactionRunner, useValue: {} },
    { provide: ConfigService, useValue: {} },
    { provide: GAME_ACTION_CLOCK, useValue: () => new Date() },
  ],
})
class EventGamesPostgresRateLimiterTestModule {}

describe('EventGamesModule PIN wiring', () => {
  it('imports event-session providers for guarded controller enhancers', () => {
    const imports = Reflect.getMetadata('imports', EventGamesModule) as unknown[];

    expect(imports).toContain(EventSessionModule);
  });

  it('resolves the session join service clock through the game clock token', async () => {
    const app = await NestFactory.createApplicationContext(EventGamesSessionJoinTestModule, {
      logger: false,
      abortOnError: false,
    });

    expect(app.get(EventGamesSessionJoinService)).toBeInstanceOf(EventGamesSessionJoinService);
    await app.close();
  });

  it('provides the shared game clock token required by session joining', () => {
    const providers = Reflect.getMetadata('providers', EventGamesModule) as unknown[];

    expect(providers).toContainEqual(expect.objectContaining({ provide: GAME_ACTION_CLOCK }));
  });

  it('resolves the session PIN issuer clock through the shared game clock token', async () => {
    const app = await NestFactory.createApplicationContext(EventGamesSessionPinTestModule, {
      logger: false,
      abortOnError: false,
    });

    expect(app.get(EventGamesSessionPinService)).toBeInstanceOf(EventGamesSessionPinService);
    await app.close();
  });

  it('resolves the PostgreSQL rate limiter clock through the shared game clock token', async () => {
    const app = await NestFactory.createApplicationContext(EventGamesPostgresRateLimiterTestModule, {
      logger: false,
      abortOnError: false,
    });

    expect(app.get(EventGamesPostgresRateLimiter)).toBeInstanceOf(EventGamesPostgresRateLimiter);
    await app.close();
  });

  it('registers the host PIN issuer required by enable-joins', () => {
    const providers = Reflect.getMetadata('providers', EventGamesModule) as unknown[];

    expect(providers).toContain(EventGamesSessionPinService);
  });

  it('registers the database-backed scheduled-start worker', () => {
    const providers = Reflect.getMetadata('providers', EventGamesModule) as unknown[];

    expect(providers).toContain(GameScheduledStartWorker);
    expect(providers).toContainEqual({ provide: GAME_SCHEDULER, useExisting: GameScheduledStartWorker });
  });

  it('wires participant game media through the storage capability', () => {
    const imports = Reflect.getMetadata('imports', EventGamesModule) as unknown[];
    const providers = Reflect.getMetadata('providers', EventGamesModule) as unknown[];

    expect(imports).toContain(PlatformOpsModule);
    expect(providers).toContain(EventGamesMediaStorageAdapter);
    expect(providers).toContainEqual({
      provide: GAME_MEDIA_STORAGE,
      useExisting: EventGamesMediaStorageAdapter,
    });
  });

  it('registers the public join route and scoped participant guard', () => {
    const controllers = Reflect.getMetadata('controllers', EventGamesModule) as unknown[];
    const providers = Reflect.getMetadata('providers', EventGamesModule) as unknown[];

    expect(controllers).toContain(GameSessionJoinController);
    expect(providers).toContain(GameParticipantGuard);
  });
});
