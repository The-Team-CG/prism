import { HttpException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type {
  PrismJoinedMultiplayerGameSession,
  PrismJoinActiveMultiplayerGameSessionInput,
} from '@prism/types';
import { readSessionSecret } from '@prism/kernel/event-session';
import { PrismTransactionRunner, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { GAME_ACTION_CLOCK } from '../contracts/game-action-store.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import { GAME_PIN_STORE, GameParticipantGrantPersistenceError, type GamePinStorePort, type JoinableGameSessionRecord } from '../contracts/game-pin-store.port';
import { GAME_RATE_LIMITER, type GameRateLimiterPort } from '../contracts/game-rate-limiter.port';

const JOIN_FAILURE = 'Game session could not be joined';
const JOIN_RATE_LIMITED = 'Too many game join attempts. Try again shortly.';
const PIN_GLOBAL_BUDGET = 'event-game:pin-join-attempts';
const PIN_PATTERN = /^\d{6}$/;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class EventGamesSessionJoinService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_PIN_STORE) private readonly pinStore: GamePinStorePort,
    private readonly transactions: PrismTransactionRunner,
    @Optional() @Inject(GAME_RATE_LIMITER) private readonly rateLimiter: GameRateLimiterPort | undefined,
    private readonly config: ConfigService,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async joinActiveMultiplayerSession(
    input: PrismJoinActiveMultiplayerGameSessionInput,
    retainedCredential?: string,
    trustedSourceAddress?: string,
  ): Promise<PrismJoinedMultiplayerGameSession> {
    const attempt = await this.prepareJoinAttempt(input, trustedSourceAddress);
    if (!attempt.pinValid) return this.rejectFailedPin(attempt.sourceFingerprint, attempt.pinDigest);

    const candidate = await this.findJoinableCandidate(input, attempt);
    if (!candidate) return this.rejectFailedPin(attempt.sourceFingerprint, attempt.pinDigest);

    const result = await this.persistJoinAttempt(input, retainedCredential, attempt, candidate);
    if (!result) throw new NotFoundException(JOIN_FAILURE);
    return {
      eventId: result.eventId,
      sessionId: result.sessionId,
      game: { title: result.title, kind: result.kind },
      status: result.status,
      participantCredential: result.participantCredential,
    };
  }

  private async prepareJoinAttempt(
    input: PrismJoinActiveMultiplayerGameSessionInput,
    trustedSourceAddress?: string,
  ) {
    if (!this.rateLimiter) {
      throw new ServiceUnavailableException('Game joining is unavailable');
    }
    const secret = this.sessionSecret();

    const now = this.clock();
    const pinDigest = this.digest(secret, 'event-game:pin:v1', input.pin);
    const sourceFingerprint = this.digest(secret, 'event-game:pin-source:v1', trustedSourceAddress ?? 'unknown');
    const attempt = await this.rateLimiter.consume({
      action: 'pin_attempt',
      sourceFingerprint,
      globalBudgetKey: PIN_GLOBAL_BUDGET,
    });
    if (!attempt.allowed) throw new HttpException(JOIN_RATE_LIMITED, 429);

    if (!UUID_V4_PATTERN.test(input.idempotencyKey)) throw new NotFoundException(JOIN_FAILURE);
    return {
      secret,
      now,
      pinDigest,
      sourceFingerprint,
      pinValid: PIN_PATTERN.test(input.pin),
    };
  }

  private async findJoinableCandidate(
    input: PrismJoinActiveMultiplayerGameSessionInput,
    attempt: Awaited<ReturnType<EventGamesSessionJoinService['prepareJoinAttempt']>>,
  ) {
    if (!attempt.pinValid) return null;
    const candidate = await this.transactions.run(
      (transaction) => this.pinStore.findJoinableSessionByPinDigest({ pinDigest: attempt.pinDigest, now: attempt.now }, transaction),
      { actorId: 'anonymous-game-participant' },
    );
    if (!candidate) return null;
    if (!this.isJoinable(candidate, attempt.now)) throw new NotFoundException(JOIN_FAILURE);
    if (input.expectedEventId && input.expectedEventId !== candidate.eventId) {
      return null;
    }
    return candidate;
  }

  private async persistJoinAttempt(
    input: PrismJoinActiveMultiplayerGameSessionInput,
    retainedCredential: string | undefined,
    attempt: Awaited<ReturnType<EventGamesSessionJoinService['prepareJoinAttempt']>>,
    candidate: JoinableGameSessionRecord,
  ) {
    const result = await this.transactions.run(
      (transaction) => this.joinInTransaction({
        input,
        retainedCredential,
        secret: attempt.secret,
        pinDigest: attempt.pinDigest,
        now: attempt.now,
        candidate,
      }, transaction),
      { actorId: 'anonymous-game-participant' },
    ).catch((error: unknown) => {
      if (error instanceof GameParticipantGrantPersistenceError) return null;
      throw error;
    });
    return result;
  }

  private async joinInTransaction(
    attempt: {
      input: PrismJoinActiveMultiplayerGameSessionInput;
      retainedCredential?: string;
      secret: string;
      pinDigest: string;
      now: Date;
      candidate: JoinableGameSessionRecord;
    },
    transaction: PrismTransactionContext,
  ) {
    const { input, retainedCredential, secret, pinDigest, now, candidate } = attempt;
    const session = await this.findSessionInJoinTransaction(input, candidate, pinDigest, now, transaction);
    if (!session) return null;
    const event = await this.findOpenEventForJoin(session, now, transaction);
    if (!event) return null;
    const credential = await this.resolveParticipantCredential(
      session.eventId, session.sessionId, input.idempotencyKey, retainedCredential, secret, transaction,
    );
    if (!credential) return null;
    return this.createOrReuseParticipantGrant(session, input.idempotencyKey, credential, secret, now, transaction);
  }

  private async findSessionInJoinTransaction(
    input: PrismJoinActiveMultiplayerGameSessionInput,
    candidate: JoinableGameSessionRecord,
    pinDigest: string,
    now: Date,
    transaction: PrismTransactionContext,
  ) {
    const session = await this.pinStore.findJoinableSessionByPinDigest({ pinDigest, now }, transaction);
    if (!this.isJoinable(session, now)) return null;
    if (session.sessionId !== candidate.sessionId || session.eventId !== candidate.eventId) return null;
    if (input.expectedEventId && input.expectedEventId !== session.eventId) return null;
    if (!(await this.eventAccess.isEventOpen(session.eventId, transaction))) return null;
    return session;
  }

  private async findOpenEventForJoin(
    session: JoinableGameSessionRecord,
    now: Date,
    transaction: PrismTransactionContext,
  ) {
    const event = await this.eventAccess.getPublicEventScope(session.eventId, transaction);
    if (!event || event.eventId !== session.eventId) return null;
    if (event.archived || event.closed) {
      await this.pinStore.revokeSessionPin({
        eventId: session.eventId,
        sessionId: session.sessionId,
        actorId: 'system:event-closure',
        now,
        reason: 'closed',
      }, transaction);
      return null;
    }
    return event;
  }

  private async resolveParticipantCredential(
    eventId: string,
    sessionId: string,
    idempotencyKey: string,
    retainedCredential: string | undefined,
    secret: string,
    transaction: PrismTransactionContext,
  ) {
    if (retainedCredential !== undefined) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(retainedCredential)) return null;
      const credential = await this.pinStore.findActiveCredential({
        eventId,
        tokenDigest: createHash('sha256').update(retainedCredential).digest('hex'),
      }, transaction);
      if (!credential) return null;
      return { credentialId: credential.id, participantCredential: retainedCredential, createCredential: false };
    }
    return {
      credentialId: randomUUID(),
      participantCredential: this.deriveCredential(secret, eventId, sessionId, idempotencyKey),
      createCredential: true,
    };
  }

  private async createOrReuseParticipantGrant(
    session: JoinableGameSessionRecord,
    idempotencyKey: string,
    credential: { credentialId: string; participantCredential: string; createCredential: boolean },
    secret: string,
    now: Date,
    transaction: PrismTransactionContext,
  ) {
    const tokenDigest = createHash('sha256').update(credential.participantCredential).digest('hex');
    const idempotencyKeyDigest = this.digest(secret, 'event-game:join-idempotency:v1', idempotencyKey, 'base64url');
    const existing = await this.pinStore.findJoinGrant({ eventId: session.eventId, idempotencyKeyDigest }, transaction);
    if (existing) {
      if (!existing.active || existing.sessionId !== session.sessionId || existing.tokenDigest !== tokenDigest) return null;
      return { eventId: session.eventId, sessionId: existing.sessionId, title: existing.title, kind: existing.kind, status: existing.status, participantCredential: credential.participantCredential };
    }
    const grant = await this.pinStore.createParticipantGrant({
      eventId: session.eventId,
      sessionId: session.sessionId,
      gameId: session.gameId,
      credentialId: credential.credentialId,
      tokenDigest,
      idempotencyKeyDigest,
      createCredential: credential.createCredential,
      now,
    }, transaction);
    if (!grant) return null;
    return { ...grant, eventId: session.eventId, participantCredential: credential.participantCredential };
  }

  private async rejectFailedPin(sourceFingerprint: string, submittedPinDigest: string): Promise<never> {
    const failurePreflight = await this.rateLimiter?.consume({
      action: 'pin_failure_check',
      sourceFingerprint,
      submittedPinDigest,
      globalBudgetKey: PIN_GLOBAL_BUDGET,
    });
    if (!failurePreflight) throw new ServiceUnavailableException('Game joining is unavailable');
    if (!failurePreflight.allowed) throw new HttpException(JOIN_RATE_LIMITED, 429);
    await this.recordFailedAttempt(sourceFingerprint, submittedPinDigest);
    throw new NotFoundException(JOIN_FAILURE);
  }

  private async recordFailedAttempt(sourceFingerprint: string, submittedPinDigest: string) {
    const result = await this.rateLimiter?.consume({
      action: 'failed_pin_attempt',
      sourceFingerprint,
      submittedPinDigest,
      globalBudgetKey: PIN_GLOBAL_BUDGET,
    });
    if (!result) throw new ServiceUnavailableException('Game joining is unavailable');
    if (!result.allowed) throw new HttpException(JOIN_RATE_LIMITED, 429);
  }

  private isJoinable(session: JoinableGameSessionRecord | null, now: Date): session is JoinableGameSessionRecord & { status: 'lobby' | 'live' } {
    return Boolean(
      session && session.entryMode === 'active' &&
      (session.status === 'lobby' || session.status === 'live') &&
      session.expiresAt.getTime() > now.getTime(),
    );
  }

  private deriveCredential(secret: string, eventId: string, sessionId: string, idempotencyKey: string) {
    return createHmac('sha256', secret)
      .update(`event-game:participant-credential:v1\0${eventId}\0${sessionId}\0${idempotencyKey}`)
      .digest('base64url');
  }

  private sessionSecret(): string {
    try {
      return readSessionSecret(this.config);
    } catch {
      throw new ServiceUnavailableException('Game joining is unavailable');
    }
  }

  private digest(secret: string, purpose: string, value: string, encoding: 'hex' | 'base64url' = 'hex') {
    return createHmac('sha256', secret).update(`${purpose}\0${value}`).digest(encoding);
  }
}
