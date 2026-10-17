import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { PrismGamePublicState, PrismSubmitEventGameActionInput } from '@prism/types';
import {
  GAME_ACTION_CLOCK,
  GAME_ACTION_STORE,
  type GameActionStorePort,
  type GameParticipantActionContext,
} from '../contracts/game-action-store.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import { GAME_RULES, type GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GAME_RATE_LIMITER, type GameRateLimiterPort } from '../contracts/game-rate-limiter.port';
import { GameScoringService } from './game-scoring.service';
import { readConfiguredVoteAggregate } from './game-vote-aggregates';
import { createAnonymousGameParticipantAlias } from '../domain/anonymous-game-participant-alias';

const PARTICIPANT_CREDENTIAL_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const ACTION_UNAVAILABLE = 'Game action is not available';

function assertSessionAcceptsAction(session: GameParticipantActionContext, now: Date) {
  if (session.status !== 'live' || !session.startedAt) {
    throw new ConflictException(ACTION_UNAVAILABLE);
  }
  if (
    session.entryMode === 'independent' &&
    ((session.availableFrom && now < session.availableFrom) ||
      (session.availableUntil && now >= session.availableUntil))
  ) {
    throw new ConflictException(ACTION_UNAVAILABLE);
  }
  return session.startedAt;
}

function resolveCurrentActionRound(
  session: GameParticipantActionContext,
  action: PrismSubmitEventGameActionInput,
  now: Date,
  sessionStartedAt: Date,
  participantKey: string,
  rules: GameRuleRegistryPort,
) {
  const rule = rules.get(session.kind);
  if (!rule) throw new ServiceUnavailableException('This game type is not ready to accept actions');

  const startedAt = new Date(sessionStartedAt.getTime() + session.totalPausedMs - (session.roundOffsetMs ?? 0));
  const currentRound = rule.getCurrentRound({
    configuration: session.configSnapshot,
    startedAt,
    now,
    participantKey,
    teamId: session.teamId,
    teamLabel: session.teamLabel,
  });
  if (
    !currentRound || currentRound.key !== action.roundKey ||
    (currentRound.deadlineAt !== null && now.getTime() > currentRound.deadlineAt.getTime())
  ) {
    throw new ConflictException(ACTION_UNAVAILABLE);
  }
  if (rule.validateSubmission({ configuration: session.configSnapshot, currentRound, action }).length > 0) {
    throw new ConflictException(ACTION_UNAVAILABLE);
  }
  return currentRound;
}

function scoreCurrentAction(
  session: GameParticipantActionContext,
  action: PrismSubmitEventGameActionInput,
  now: Date,
  participantKey: string,
  rules: GameRuleRegistryPort,
  scoring: GameScoringService,
) {
  const sessionStartedAt = assertSessionAcceptsAction(session, now);
  const currentRound = resolveCurrentActionRound(session, action, now, sessionStartedAt, participantKey, rules);
  return {
    currentRound,
    sessionStartedAt: sessionStartedAt.toISOString(),
    score: scoring.score({
      kind: session.kind,
      configuration: session.configSnapshot,
      action,
      currentRound,
      submittedAt: now,
    }),
  };
}

@Injectable()
export class GameActionService {
  constructor(
    @Inject(GAME_ACTION_STORE) private readonly store: GameActionStorePort,
    private readonly transactions: PrismTransactionRunner,
    @Inject(GAME_RULES) private readonly rules: GameRuleRegistryPort,
    private readonly scoring: GameScoringService,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly clock: () => Date = () => new Date(),
    @Optional() @Inject(GAME_RATE_LIMITER) private readonly rateLimiter?: GameRateLimiterPort,
    @Optional() @Inject(GAME_EVENT_ACCESS) private readonly eventAccess?: GameEventAccessPort,
  ) {}

  async submitAction(
    sessionId: string,
    participantCredential: string,
    action: PrismSubmitEventGameActionInput,
  ): Promise<PrismGamePublicState> {
    if (!PARTICIPANT_CREDENTIAL_PATTERN.test(participantCredential)) {
      throw new NotFoundException(ACTION_UNAVAILABLE);
    }
    const tokenDigest = createHash('sha256').update(participantCredential).digest('hex');
    const now = this.clock();
    const initialContext = await this.transactions.run(
      (transaction) => this.store.findParticipantActionContext({ sessionId, tokenDigest }, transaction),
      { actorId: 'anonymous-game-participant' },
    );
    if (!initialContext) throw new NotFoundException(ACTION_UNAVAILABLE);
    if (!this.rateLimiter) throw new ServiceUnavailableException('Game action rate limiting is unavailable');
    const rateLimit = await this.rateLimiter.consume({
      eventId: initialContext.eventId,
      action: action.actionKind === 'vote' ? 'submit_vote' : 'submit_answer',
      participantTokenId: initialContext.participationGrantId,
    });
    if (!rateLimit.allowed) {
      throw new HttpException('Too many game submissions. Please wait before trying again.', HttpStatus.TOO_MANY_REQUESTS);
    }

    return this.transactions.run(async (transaction) => {
      const session = await this.store.findParticipantActionContext({ sessionId, tokenDigest }, transaction);
      if (!session) throw new NotFoundException(ACTION_UNAVAILABLE);
      if (!this.eventAccess || !(await this.eventAccess.isEventOpen(session.eventId, transaction))) {
        throw new ConflictException(ACTION_UNAVAILABLE);
      }

      const { currentRound, score, sessionStartedAt } = scoreCurrentAction(
        session, action, now, tokenDigest, this.rules, this.scoring,
      );
      const participant = await this.store.recordParticipantAction({
        eventId: session.eventId,
        sessionId: session.sessionId,
        participationGrantId: session.participationGrantId,
        tokenDigest,
        roundKey: currentRound.key,
        roundNumber: currentRound.number,
        actionKind: action.actionKind,
        payload: action.payload,
        points: score.points,
        isCorrect: score.isCorrect,
        ...(score.result?.kind === 'singleplayer-choice' ? { result: score.result } : {}),
        ...(currentRound.teamAssignment ? { teamAssignment: currentRound.teamAssignment } : {}),
        deadlineAt: currentRound.deadlineAt,
        createdAt: now,
      }, transaction);
      if (!participant) throw new ConflictException(ACTION_UNAVAILABLE);
      const aggregateResults = await readConfiguredVoteAggregate({
        actionStore: this.store,
        transaction,
        eventId: session.eventId,
        sessionId: session.sessionId,
        kind: session.kind,
        configSnapshot: session.configSnapshot,
        roundKey: currentRound.key,
        status: session.status,
      });

      return {
        sessionId: session.sessionId,
        game: { title: session.title, kind: session.kind },
        status: 'live',
        startedAt: sessionStartedAt,
        currentRound: { key: currentRound.key, number: currentRound.number, total: currentRound.total },
        currentPrompt: currentRound.prompt,
        participant: {
          participantAlias: createAnonymousGameParticipantAlias(session.participationGrantId),
          hasSubmitted: true,
          ...(action.actionKind === 'vote' ? { hasVoted: true } : {}),
          score: participant.points,
          ...(participant.result ? { result: participant.result } : {}),
          ...(currentRound.participantData ? { gameData: currentRound.participantData } : {}),
        },
        aggregateResults,
      };
    }, { actorId: 'anonymous-game-participant' });
  }
}
