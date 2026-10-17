import type { PrismEventGameKind } from '@prism/types';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export const GAME_PIN_STORE = Symbol('GAME_PIN_STORE');

/** Signals that a grant insert/readback invariant failed and the surrounding transaction must roll back. */
export class GameParticipantGrantPersistenceError extends Error {
  constructor() {
    super('Participant grant could not be verified');
    this.name = 'GameParticipantGrantPersistenceError';
  }
}

export interface JoinableGameSessionRecord {
  eventId: string;
  sessionId: string;
  gameId: string;
  title: string;
  kind: PrismEventGameKind;
  entryMode: 'active' | 'independent';
  status: 'scheduled' | 'lobby' | 'live' | 'paused' | 'completed' | 'cancelled';
  expiresAt: Date;
}

export interface GameSessionJoinResult {
  sessionId: string;
  title: string;
  kind: PrismEventGameKind;
  status: 'lobby' | 'live';
}

export interface GamePinCandidate {
  pinDigest: string;
  generationAttempt: number;
}

export interface IssuedGamePinRecord {
  pinDigest: string;
  generationAttempt: number;
  expiresAt: Date;
  joinsWereEnabled: boolean;
}

export interface GamePinStorePort {
  /** Remove expired active PIN reservations and preserve their digest-only history in this transaction. */
  releaseExpiredReservations(
    input: { now: Date },
    transaction: PrismTransactionContext,
  ): Promise<number>;
  findActivePinByIdempotencyDigest(
    input: { eventId: string; sessionId: string; idempotencyKeyDigest: string; now: Date },
    transaction: PrismTransactionContext,
  ): Promise<IssuedGamePinRecord | null>;
  issueSessionPin(
    input: {
      eventId: string;
      sessionId: string;
      idempotencyKeyDigest: string;
      candidates: GamePinCandidate[];
      expiresAt: Date;
      now: Date;
      actorId: string;
    },
    transaction: PrismTransactionContext,
  ): Promise<IssuedGamePinRecord | null>;
  revokeSessionPin(
    input: { eventId: string; sessionId: string; actorId: string; now: Date; reason: 'revoked' | 'closed' },
    transaction: PrismTransactionContext,
  ): Promise<boolean | null>;
  findJoinableSessionByPinDigest(
    input: { pinDigest: string; now: Date },
    transaction: PrismTransactionContext,
  ): Promise<JoinableGameSessionRecord | null>;
  findActiveCredential(
    input: { eventId: string; tokenDigest: string },
    transaction: PrismTransactionContext,
  ): Promise<{ id: string } | null>;
  isParticipantAuthorized(
    input: { sessionId: string; tokenDigest: string },
    transaction: PrismTransactionContext,
  ): Promise<boolean>;
  findJoinGrant(
    input: { eventId: string; idempotencyKeyDigest: string },
    transaction: PrismTransactionContext,
  ): Promise<(GameSessionJoinResult & { eventId: string; credentialId: string; tokenDigest: string; active: boolean }) | null>;
  createParticipantGrant(
    input: {
      eventId: string;
      sessionId: string;
      gameId: string;
      credentialId: string;
      tokenDigest: string;
      idempotencyKeyDigest: string;
      createCredential: boolean;
      now: Date;
    },
    transaction: PrismTransactionContext,
  ): Promise<GameSessionJoinResult | null>;
}
