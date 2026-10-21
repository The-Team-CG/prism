import type { PrismEventGameKind, PrismSubmitEventGameActionInput } from '@prism/types';
import type { PrismGameParticipantResult, PrismGameSessionResult } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_ACTION_STORE = Symbol('GAME_ACTION_STORE');
export const GAME_ACTION_CLOCK = Symbol('GAME_ACTION_CLOCK');

export interface GameParticipantStateSummary {
  score: number | null;
  hasSubmitted: boolean;
  hasVoted?: boolean;
  result?: PrismGameParticipantResult;
}

export interface StoredGameResponse {
  id: string;
  roundNumber: number;
  participantAlias: string;
  response: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  moderationStatus: 'pending' | 'visible' | 'hidden';
  scoreAwarded: number | null;
  submittedAt: Date;
}

export interface GameResponseHistoryPage {
  items: StoredGameResponse[];
  hasMore: boolean;
}

export interface GameParticipantActionContext {
  eventId: string;
  sessionId: string;
  gameId: string;
  title: string;
  kind: PrismEventGameKind;
  entryMode: 'active' | 'independent';
  availableFrom: Date | null;
  availableUntil: Date | null;
  status: string;
  configSnapshot: Readonly<Record<string, unknown>>;
  startedAt: Date | null;
  endedAt: Date | null;
  pausedAt: Date | null;
  totalPausedMs: number;
  roundOffsetMs: number;
  teamId: string | null;
  teamLabel: string | null;
  participationGrantId: string;
  wheelResult: PrismGameSessionResult | null;
}

export interface GameActionStorePort {
  findParticipantActionContext(
    input: { sessionId: string; tokenDigest: string },
    transaction: PrismTransactionContext,
  ): Promise<GameParticipantActionContext | null>;
  recordParticipantAction(
    input: {
      eventId: string;
      sessionId: string;
      participationGrantId: string;
      tokenDigest: string;
      roundKey: string;
      roundNumber: number;
      actionKind: PrismSubmitEventGameActionInput['actionKind'];
      payload: PrismSubmitEventGameActionInput['payload'];
      points: number;
      isCorrect: boolean;
      result?: PrismGameParticipantResult;
      teamAssignment?: { teamId: string; teamLabel: string };
      deadlineAt: Date | null;
      createdAt: Date;
    },
    transaction: PrismTransactionContext,
  ): Promise<{ points: number; result?: PrismGameParticipantResult } | null>;
  getParticipantState(
    input: { eventId: string; sessionId: string; participationGrantId: string; roundKey: string | null },
    transaction: PrismTransactionContext,
  ): Promise<GameParticipantStateSummary>;
  getRoundVoteCounts(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<Array<{ label: string; count: number }>>;
  getRoundModerationQueue(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<Array<{ id: string; roundNumber: number; response: string }>>;
  getFamilyFeudModerationQueue(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<Array<{ id: string; roundNumber: number; answer: string }>>;
  getApprovedRoundResponses(
    input: { eventId: string; sessionId: string; roundKey: string },
    transaction: PrismTransactionContext,
  ): Promise<string[]>;
  listResponseHistory(
    input: {
      eventId: string;
      sessionId: string;
      archivedAt: Date | null;
      now: Date;
      limit: number;
      cursor: { createdAt: Date; id: string } | null;
    },
    transaction: PrismTransactionContext,
  ): Promise<GameResponseHistoryPage | null>;
  listResponseRetentionEventIds(now: Date, transaction: PrismTransactionContext): Promise<string[]>;
  redactExpiredResponses(
    input: { eventId: string; archivedAt: Date | null; now: Date },
    transaction: PrismTransactionContext,
  ): Promise<number>;
}
