import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { PrismTransactionRunner, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
import {
  eventGameMediaObjectIdSchema,
  eventGameMediaObjectIdsSchema,
  eventGameTemplateConfigurationSchema,
  type PrismEventGameAnalytics,
  type PrismEventGameMediaAuthorization,
  type PrismEventGameResponseHistoryQuery,
  type PrismGameHostState,
  type PrismGamePublicState,
  type PrismGameSessionResponsePage,
  type PrismVerifiedEventActor,
} from '@prism/types';
import {
  GAME_ACTION_CLOCK,
  GAME_ACTION_STORE,
  type GameActionStorePort,
  type GameParticipantActionContext,
  type GameParticipantStateSummary,
} from '../contracts/game-action-store.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import { GAME_RULES, type GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GAME_SESSION_STORE, type GameHostReadContext, type GameSessionStorePort } from '../contracts/game-session-store.port';
import { GAME_MEDIA_STORAGE, type GameMediaStoragePort } from '../contracts/game-media-storage.port';
import { readConfiguredVoteAggregate } from './game-vote-aggregates';

const PARTICIPANT_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const COMPETITIVE_GAME_KINDS = new Set([
  'live-trivia', 'bingo', 'guess-picture', 'spin-wheel', 'family-feud',
]);
const RESPONSE_CURSOR_SCHEMA = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
}).strict();

type HostRound = NonNullable<ReturnType<typeof currentRoundFor>>;

interface ParticipantReadData {
  participant: GameParticipantStateSummary;
  aggregateResults: PrismGamePublicState['aggregateResults'];
  approvedResponses: readonly string[];
  leaderboard: PrismGamePublicState['leaderboard'];
}

async function readParticipantData(
  actionStore: GameActionStorePort,
  sessions: GameSessionStorePort,
  transaction: PrismTransactionContext,
  session: GameParticipantActionContext,
  status: PrismGamePublicState['status'],
  round: HostRound | null,
): Promise<ParticipantReadData> {
  const participant = await actionStore.getParticipantState({
    eventId: session.eventId,
    sessionId: session.sessionId,
    participationGrantId: session.participationGrantId,
    roundKey: round?.key ?? null,
  }, transaction);
  const aggregateResults = await readConfiguredVoteAggregate({
    actionStore,
    transaction,
    eventId: session.eventId,
    sessionId: session.sessionId,
    kind: session.kind,
    configSnapshot: session.configSnapshot,
    roundKey: round?.key ?? null,
    status,
  });
  let approvedResponses: readonly string[] = [];
  if (status === 'paused' && session.kind === 'split-the-room' && round) {
    approvedResponses = await actionStore.getApprovedRoundResponses({
      eventId: session.eventId,
      sessionId: session.sessionId,
      roundKey: round.key,
    }, transaction);
  }
  const leaderboard = COMPETITIVE_GAME_KINDS.has(session.kind)
    ? await sessions.getPublicLeaderboard({ eventId: session.eventId, sessionId: session.sessionId }, transaction)
    : [];
  return { participant, aggregateResults, approvedResponses, leaderboard };
}

function publicParticipantState(
  session: GameParticipantActionContext,
  status: PrismGamePublicState['status'],
  currentTime: Date,
  round: HostRound | null,
  data: ParticipantReadData,
): PrismGamePublicState {
  return {
    sessionId: session.sessionId,
    game: { title: session.title, kind: session.kind },
    status,
    startedAt: session.startedAt?.toISOString() ?? null,
    serverTime: currentTime.toISOString(),
    currentRound: round ? {
      key: round.key,
      number: round.number,
      total: round.total,
      deadlineAt: round.deadlineAt?.toISOString() ?? null,
    } : null,
    currentPrompt: round?.prompt ?? null,
    participant: {
      ...data.participant,
      ...(round?.participantData ? { gameData: round.participantData } : {}),
    },
    ...(session.wheelResult ? { sessionResult: session.wheelResult } : {}),
    ...(data.leaderboard?.length ? { leaderboard: data.leaderboard } : {}),
    aggregateResults: data.aggregateResults,
    ...(data.approvedResponses.length ? { approvedResponses: data.approvedResponses } : {}),
  };
}

function hostRoundReveal(
  context: GameHostReadContext,
  status: PrismGameHostState['status'],
  round: HostRound,
): Pick<NonNullable<PrismGameHostState['currentRound']>, 'revealedAnswer' | 'answerBoard'> {
  if (status !== 'paused' && context.kind !== 'family-feud') return {};
  const parsed = eventGameTemplateConfigurationSchema.safeParse(context.configSnapshot.configuration);
  if (!parsed.success) return {};
  if (context.kind === 'live-trivia' && parsed.data.kind === 'live-trivia') {
    const revealedAnswer = parsed.data.rounds.find(({ key }) => key === round.key)?.correctAnswer;
    return revealedAnswer ? { revealedAnswer } : {};
  }
  if (context.kind === 'family-feud' && parsed.data.kind === 'family-feud') {
    const answerBoard = parsed.data.rounds.find(({ key }) => key === round.key)?.answers
      .map(({ answer, alternatives, points }) => ({ answer, alternatives, points }));
    return answerBoard ? { answerBoard } : {};
  }
  return {};
}

function hostRoundView(
  context: GameHostReadContext,
  status: PrismGameHostState['status'],
  round: HostRound | null,
  pendingSubmissions: NonNullable<PrismGameHostState['currentRound']>['pendingSubmissions'],
): PrismGameHostState['currentRound'] {
  if (!round) return null;
  return {
    key: round.key,
    number: round.number,
    total: round.total,
    prompt: round.prompt,
    deadlineAt: round.deadlineAt?.toISOString() ?? null,
    ...hostRoundReveal(context, status, round),
    ...(context.kind === 'split-the-room' ? { pendingSubmissions } : {}),
  };
}

function pendingSplitResponses(
  store: GameActionStorePort,
  transaction: PrismTransactionContext,
  input: { eventId: string; sessionId: string; context: GameHostReadContext; round: HostRound | null; status: PrismGameHostState['status'] },
) {
  if (input.context.kind !== 'split-the-room' || !input.round || !['live', 'paused'].includes(input.status)) {
    return Promise.resolve([]);
  }
  return store.getRoundModerationQueue({
    eventId: input.eventId, sessionId: input.sessionId, roundKey: input.round.key,
  }, transaction);
}

function pendingFamilyFeudAnswers(
  store: GameActionStorePort,
  transaction: PrismTransactionContext,
  input: { eventId: string; sessionId: string; context: GameHostReadContext; round: HostRound | null; status: PrismGameHostState['status'] },
) {
  if (input.context.kind !== 'family-feud' || !input.round || !['live', 'paused'].includes(input.status)) {
    return Promise.resolve([]);
  }
  return store.getFamilyFeudModerationQueue({
    eventId: input.eventId, sessionId: input.sessionId, roundKey: input.round.key,
  }, transaction);
}

function sessionStatus(value: string): PrismGamePublicState['status'] {
  if (['scheduled', 'lobby', 'live', 'paused', 'completed', 'cancelled'].includes(value)) {
    return value as PrismGamePublicState['status'];
  }
  throw new Error(`Invalid persisted game session status: ${value}`);
}

function sessionTime(
  status: PrismGamePublicState['status'],
  pausedAt: Date | null,
  endedAt: Date | null,
  now: Date,
): Date {
  if (status === 'paused') return pausedAt ?? now;
  if (status === 'completed' || status === 'cancelled') return endedAt ?? now;
  return now;
}

function effectiveStartedAt(startedAt: Date | null, totalPausedMs: number, roundOffsetMs: number): Date | null {
  return startedAt ? new Date(startedAt.getTime() + totalPausedMs - roundOffsetMs) : null;
}

function currentRoundFor(
  rules: GameRuleRegistryPort,
  kind: PrismGamePublicState['game']['kind'],
  status: PrismGamePublicState['status'],
  configuration: Readonly<Record<string, unknown>>,
  startedAt: Date | null,
  now: Date,
  participantKey?: string,
  teamId?: string | null,
  teamLabel?: string | null,
) {
  if (!startedAt || status === 'scheduled' || status === 'lobby') return null;
  const rule = rules.get(kind);
  return rule?.getCurrentRound({
    configuration,
    startedAt,
    now,
    ...(participantKey ? { participantKey } : {}),
    ...(teamId !== undefined ? { teamId } : {}),
    ...(teamLabel !== undefined ? { teamLabel } : {}),
  }) ?? null;
}

function currentRoundMediaObjectIds(round: HostRound | null): string[] {
  const data = round?.participantData;
  if (!data) return [];
  if (data.kind === 'guess-picture' || data.kind === 'guess-picture-solo') return [data.mediaObjectId];
  if (data.kind === 'spot-the-difference') {
    return [data.originalMediaObjectId, data.comparisonMediaObjectId];
  }
  return [];
}

function encodeCursor(value: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({ createdAt: value.createdAt.toISOString(), id: value.id }), 'utf8').toString('base64url');
}

function decodeCursor(cursor: string | undefined) {
  if (!cursor) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const result = RESPONSE_CURSOR_SCHEMA.safeParse(parsed);
    if (!result.success) throw new Error('invalid response cursor');
    return { createdAt: new Date(result.data.createdAt), id: result.data.id };
  } catch {
    throw new BadRequestException('Response history cursor is invalid');
  }
}

@Injectable()
export class GameReadModelService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_SESSION_STORE) private readonly sessions: GameSessionStorePort,
    @Inject(GAME_ACTION_STORE) private readonly actionStore: GameActionStorePort,
    private readonly transactions: PrismTransactionRunner,
    @Inject(GAME_RULES) private readonly rules: GameRuleRegistryPort,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly clock: () => Date = () => new Date(),
    @Optional() @Inject(GAME_MEDIA_STORAGE) private readonly mediaStorage?: GameMediaStoragePort,
  ) {}

  async getParticipantState(sessionId: string, participantCredential: string): Promise<PrismGamePublicState> {
    if (!PARTICIPANT_CREDENTIAL_PATTERN.test(participantCredential)) {
      throw new NotFoundException('Game participant access is not available');
    }
    const tokenDigest = createHash('sha256').update(participantCredential).digest('hex');
    const now = this.clock();

    return this.transactions.run(async (transaction) => {
      const session = await this.actionStore.findParticipantActionContext({ sessionId, tokenDigest }, transaction);
      if (!session) throw new NotFoundException('Game participant access is not available');

      const status = sessionStatus(session.status);
      const currentTime = sessionTime(status, session.pausedAt, session.endedAt, now);
      const startedAt = effectiveStartedAt(session.startedAt, session.totalPausedMs, session.roundOffsetMs ?? 0);
      const round = currentRoundFor(
        this.rules, session.kind, status, session.configSnapshot, startedAt, currentTime, tokenDigest,
        session.teamId, session.teamLabel,
      );
      const data = await readParticipantData(this.actionStore, this.sessions, transaction, session, status, round);
      return publicParticipantState(session, status, currentTime, round, data);
    }, { actorId: 'anonymous-game-participant' });
  }

  async getParticipantMediaAuthorization(
    sessionId: string,
    objectId: string,
    participantCredential: string,
  ): Promise<PrismEventGameMediaAuthorization> {
    if (
      !PARTICIPANT_CREDENTIAL_PATTERN.test(participantCredential)
      || !eventGameMediaObjectIdSchema.safeParse(objectId).success
      || !this.mediaStorage
    ) {
      throw new NotFoundException('Game media is not available');
    }
    const tokenDigest = createHash('sha256').update(participantCredential).digest('hex');
    const mediaStorage = this.mediaStorage;

    return this.transactions.run(async (transaction) => {
      const session = await this.actionStore.findParticipantActionContext({ sessionId, tokenDigest }, transaction);
      if (!session) throw new NotFoundException('Game media is not available');

      const status = sessionStatus(session.status);
      if (!['live', 'paused'].includes(status)) {
        throw new NotFoundException('Game media is not available');
      }
      const currentTime = sessionTime(status, session.pausedAt, session.endedAt, this.clock());
      const startedAt = effectiveStartedAt(session.startedAt, session.totalPausedMs, session.roundOffsetMs ?? 0);
      const round = currentRoundFor(
        this.rules, session.kind, status, session.configSnapshot, startedAt, currentTime, tokenDigest,
        session.teamId, session.teamLabel,
      );
      const currentMediaIds = currentRoundMediaObjectIds(round);
      if (!currentMediaIds.includes(objectId)) {
        throw new NotFoundException('Game media is not available');
      }
      const configuredIds = eventGameMediaObjectIdsSchema.safeParse(
        session.configSnapshot.mediaObjectIds ?? [],
      );
      if (!configuredIds.success || !configuredIds.data.includes(objectId)) {
        throw new NotFoundException('Game media is not available');
      }

      return mediaStorage.issueParticipantDownloadAuthorization({
        eventId: session.eventId,
        gameId: session.gameId,
        objectId,
      }, transaction);
    }, { actorId: 'anonymous-game-participant' });
  }

  async getHostState(eventId: string, sessionId: string, actor: PrismVerifiedEventActor): Promise<PrismGameHostState> {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(
      (transaction) => this.buildHostState(eventId, sessionId, transaction),
      { actorId: actor.actorId },
    );
  }

  private async buildHostState(eventId: string, sessionId: string, transaction: PrismTransactionContext) {
    const [state, context] = await Promise.all([
      this.sessions.getHostState({ eventId, sessionId }, transaction),
      this.sessions.getHostReadContext({ eventId, sessionId }, transaction),
    ]);
    if (!state || !context) throw new NotFoundException('Game session not found');
    const status = sessionStatus(context.status);
    const currentTime = sessionTime(status, context.pausedAt, context.endedAt, this.clock());
    const startedAt = effectiveStartedAt(context.startedAt, context.totalPausedMs, context.roundOffsetMs ?? 0);
    const round = currentRoundFor(this.rules, context.kind, status, context.configSnapshot, startedAt, currentTime);
    const moderationContext = { eventId, sessionId, context, round, status };
    const [aggregateResults, pendingSubmissions, pendingAnswers] = await Promise.all([
      readConfiguredVoteAggregate({
        actionStore: this.actionStore,
        transaction,
        eventId,
        sessionId,
        kind: context.kind,
        configSnapshot: context.configSnapshot,
        roundKey: round?.key ?? null,
        status,
      }),
      pendingSplitResponses(this.actionStore, transaction, moderationContext),
      pendingFamilyFeudAnswers(this.actionStore, transaction, moderationContext),
    ]);
    const currentRound = hostRoundView(context, status, round, pendingSubmissions);
    return {
      ...state,
      serverTime: currentTime.toISOString(),
      ...(aggregateResults.length ? { aggregateResults } : {}),
      currentRound: currentRound && round && context.kind === 'family-feud'
        ? { ...currentRound, pendingAnswers }
        : currentRound,
    };
  }

  async getEventAnalytics(eventId: string, actor: PrismVerifiedEventActor): Promise<PrismEventGameAnalytics> {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(
      (transaction) => this.sessions.getEventAnalytics(eventId, transaction),
      { actorId: actor.actorId },
    );
  }

  async getResponseHistory(
    eventId: string,
    sessionId: string,
    actor: PrismVerifiedEventActor,
    pagination: Partial<PrismEventGameResponseHistoryQuery> = {},
  ): Promise<PrismGameSessionResponsePage> {
    await this.eventAccess.assertAdminAccess(eventId, actor);
    const limit = pagination.limit ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Response history limit is invalid');
    }
    const cursor = decodeCursor(pagination.cursor);
    const now = this.clock();

    return this.transactions.run(async (transaction) => {
      const event = await this.eventAccess.getResponseRetentionScope(eventId, transaction);
      if (!event) throw new NotFoundException('Event not found');
      if (!event.closed) throw new ConflictException('Game responses are available after event closure');
      const page = await this.actionStore.listResponseHistory({
        eventId,
        sessionId,
        archivedAt: event.archivedAt,
        now,
        limit,
        cursor,
      }, transaction);
      if (!page) throw new NotFoundException('Game session not found');
      const last = page.items[page.items.length - 1];

      return {
        sessionId,
        items: page.items.map((item) => ({
          id: item.id,
          roundNumber: item.roundNumber,
          participantAlias: item.participantAlias,
          response: item.response,
          moderationStatus: item.moderationStatus,
          scoreAwarded: item.scoreAwarded,
          submittedAt: item.submittedAt.toISOString(),
        })),
        limit,
        nextCursor: page.hasMore && last ? encodeCursor({ createdAt: last.submittedAt, id: last.id }) : null,
        hasMore: page.hasMore,
      };
    }, { actorId: actor.actorId });
  }
}
