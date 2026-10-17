import type { PrismEventGameAnalytics, PrismEventGameKind, PrismGameHostState, PrismGameSessionResult } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { GameDefinitionEntryMode, GameDefinitionStatus } from './game-definition-store.port';

export const GAME_SESSION_STORE = Symbol('GAME_SESSION_STORE');

export interface PublishedGameDefinitionForSession {
  id: string;
  eventId: string;
  title: string;
  kind: PrismEventGameKind;
  entryMode: GameDefinitionEntryMode;
  status: Extract<GameDefinitionStatus, 'published'>;
  version: number;
  configVersionId: string;
  config: Readonly<Record<string, unknown>>;
  availableFrom: Date | null;
  availableUntil: Date | null;
}

export type GameSessionStatus = 'scheduled' | 'lobby' | 'live' | 'paused' | 'completed' | 'cancelled';

export interface GameSessionRecord {
  id: string;
  eventId: string;
  gameId: string;
  configVersionId: string;
  configSnapshot: Readonly<Record<string, unknown>>;
  title: string;
  kind: PrismEventGameKind;
  entryMode: GameDefinitionEntryMode;
  status: GameSessionStatus;
  scheduledStartAt: Date | null;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface GameHostReadContext {
  kind: PrismEventGameKind;
  status: GameSessionStatus;
  configSnapshot: Readonly<Record<string, unknown>>;
  startedAt: Date | null;
  endedAt: Date | null;
  pausedAt: Date | null;
  totalPausedMs: number;
  roundOffsetMs: number;
  wheelResult: PrismGameSessionResult | null;
}

export interface CreateHostGameSessionRecord {
  id: string;
  eventId: string;
  gameId: string;
  configVersionId: string;
  configSnapshot: Readonly<Record<string, unknown>>;
  entryMode: GameDefinitionEntryMode;
  status: Extract<GameSessionStatus, 'scheduled' | 'lobby'>;
  scheduledStartAt: Date | null;
  createdBy: string;
  startIdempotencyKey: string;
}

export interface GameSessionStorePort {
  findPublishedDefinitionForSession(
    scope: { eventId: string; gameId: string },
    transaction: PrismTransactionContext,
  ): Promise<PublishedGameDefinitionForSession | null>;
  createHostSession(input: CreateHostGameSessionRecord, transaction: PrismTransactionContext): Promise<GameSessionRecord>;
  getHostState(
    scope: { eventId: string; sessionId: string },
    transaction: PrismTransactionContext,
  ): Promise<PrismGameHostState | null>;
  getHostReadContext(
    scope: { eventId: string; sessionId: string },
    transaction: PrismTransactionContext,
  ): Promise<GameHostReadContext | null>;
  getPublicLeaderboard(
    scope: { eventId: string; sessionId: string },
    transaction: PrismTransactionContext,
  ): Promise<Array<{ rank: number; label: string; score: number; teamLabel?: string }>>;
  getEventAnalytics(
    eventId: string,
    transaction: PrismTransactionContext,
  ): Promise<PrismEventGameAnalytics>;
}
