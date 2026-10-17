import { ConflictException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomInt } from 'node:crypto';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { PrismGameHostPinIssueResult, PrismVerifiedEventActor } from '@prism/types';
import { GAME_ACTION_CLOCK } from '../contracts/game-action-store.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import { GAME_PIN_STORE, type GamePinStorePort } from '../contracts/game-pin-store.port';
import { EventGamesHostCommandService } from './event-games-host-command.service';

const PIN_CANDIDATE_COUNT = 5;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class EventGamesSessionPinService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_PIN_STORE) private readonly pinStore: GamePinStorePort,
    private readonly hostCommands: EventGamesHostCommandService,
    private readonly transactions: PrismTransactionRunner,
    private readonly config: ConfigService,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async issueSessionPin(
    eventId: string,
    sessionId: string,
    actor: PrismVerifiedEventActor,
    input: { idempotencyKey: string; reason?: string },
  ): Promise<PrismGameHostPinIssueResult> {
    const secret = this.sessionSecret();
    if (!UUID_V4_PATTERN.test(input.idempotencyKey)) {
      throw new ConflictException('PIN issuance requires a new valid request key; rotate the PIN to try again');
    }

    await this.eventAccess.assertHostAccess(eventId, actor);
    const now = this.clock();
    const idempotencyKeyDigest = this.digest(secret, 'event-game:pin-issue-idempotency:v1', `${eventId}\0${sessionId}\0${input.idempotencyKey}`);
    const existing = await this.transactions.run((transaction) => this.pinStore.findActivePinByIdempotencyDigest({
      eventId, sessionId, idempotencyKeyDigest, now,
    }, transaction), { actorId: actor.actorId });
    if (existing) {
      throw new ConflictException('This PIN was already revealed once. Rotate it with a new request key to reveal another PIN.');
    }

    const { expiresAt, codes, candidates } = this.createCandidates(secret, now);
    const requestReceiptId = idempotencyKeyDigest;
    const persisted = await this.hostCommands.executeHostCommand({
      eventId,
      actor,
      resourceType: 'session',
      resourceId: sessionId,
      action: 'enable_joins',
      command: {
        command: 'enable-joins',
        issueIdempotencyKeyDigest: idempotencyKeyDigest,
        pinCandidates: candidates,
        expiresAt: expiresAt.toISOString(),
        now: now.toISOString(),
      },
      requestReceiptId,
    });

    return this.verifyIssuedPin({ eventId, sessionId, actor, idempotencyKeyDigest, candidates, codes, persisted });
  }

  private sessionSecret(): string {
    const secret = this.config.get<string>('PRISM_SESSION_SECRET') ?? this.config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException('Session PIN issuance is unavailable');
    }
    return secret;
  }

  private createCandidates(secret: string, now: Date) {
    const expiresAt = new Date(now.getTime() + this.pinTtlHours() * 60 * 60 * 1000);
    const codes = Array.from({ length: PIN_CANDIDATE_COUNT }, () => randomInt(0, 1_000_000).toString().padStart(6, '0'));
    const candidates = codes.map((pin, generationAttempt) => ({
      pinDigest: this.digest(secret, 'event-game:pin:v1', pin),
      generationAttempt,
    }));
    return { expiresAt, codes, candidates };
  }

  private async verifyIssuedPin(input: {
    eventId: string;
    sessionId: string;
    actor: PrismVerifiedEventActor;
    idempotencyKeyDigest: string;
    candidates: Array<{ pinDigest: string; generationAttempt: number }>;
    codes: string[];
    persisted: Awaited<ReturnType<EventGamesHostCommandService['executeHostCommand']>>;
  }): Promise<PrismGameHostPinIssueResult> {
    const { eventId, sessionId, codes, persisted } = input;
    const attempt = this.verifiedGenerationAttempt(input);
    const active = await this.findActiveReservation(input, attempt);

    return {
      ...persisted,
      resourceType: 'session',
      action: 'enable_joins',
      outcome: 'joins_enabled',
      pin: codes[attempt]!,
      expiresAt: active.expiresAt.toISOString(),
    };
  }

  private verifiedGenerationAttempt(input: {
    eventId: string;
    sessionId: string;
    candidates: Array<{ pinDigest: string; generationAttempt: number }>;
    persisted: Awaited<ReturnType<EventGamesHostCommandService['executeHostCommand']>>;
  }): number {
    const { eventId, sessionId, candidates, persisted } = input;
    if (
      persisted.eventId !== eventId || persisted.resourceType !== 'session' || persisted.resourceId !== sessionId ||
      persisted.action !== 'enable_joins' || persisted.outcome !== 'joins_enabled'
    ) {
      throw new ConflictException('PIN issuance could not be verified. Rotate the PIN to try again.');
    }

    const attempt = persisted.generationAttempt;
    if (typeof attempt !== 'number' || !Number.isInteger(attempt) || attempt < 0 || attempt >= candidates.length) {
      throw new ConflictException('PIN issuance could not be verified. Rotate the PIN to try again.');
    }
    return attempt;
  }

  private async findActiveReservation(
    input: {
      eventId: string;
      sessionId: string;
      actor: PrismVerifiedEventActor;
      idempotencyKeyDigest: string;
      candidates: Array<{ pinDigest: string; generationAttempt: number }>;
    },
    attempt: number,
  ) {
    const active = await this.transactions.run((transaction) => this.pinStore.findActivePinByIdempotencyDigest({
      eventId: input.eventId,
      sessionId: input.sessionId,
      idempotencyKeyDigest: input.idempotencyKeyDigest,
      now: this.clock(),
    }, transaction), { actorId: input.actor.actorId });
    if (!active || active.generationAttempt !== attempt || active.pinDigest !== input.candidates[attempt]?.pinDigest) {
      throw new ConflictException('PIN issuance could not be verified. Rotate the PIN to try again.');
    }
    return active;
  }

  private pinTtlHours() {
    const configured = this.config.get<string>('EVENT_GAME_PIN_TTL_HOURS');
    const hours = configured === undefined ? 24 : Number(configured);
    if (!Number.isInteger(hours) || hours < 1 || hours > 168) {
      throw new ServiceUnavailableException('Session PIN expiry configuration is invalid');
    }
    return hours;
  }

  private digest(secret: string, purpose: string, value: string) {
    return createHmac('sha256', secret).update(`${purpose}\0${value}`).digest('hex');
  }
}
