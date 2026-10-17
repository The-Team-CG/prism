import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismTransactionRunner, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismCreateGameSessionInput, PrismGameHostCommandInput, PrismVerifiedEventActor } from '@prism/types';
import { GAME_AUDIT, type GameAuditPort } from '../contracts/game-audit.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import { GAME_ACTION_CLOCK } from '../contracts/game-action-store.port';
import { GAME_RULES, type GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GAME_SCHEDULER, type GameSchedulerPort } from '../contracts/game-scheduler.port';
import { GAME_SESSION_STORE, type GameSessionStorePort } from '../contracts/game-session-store.port';
import { EventGamesHostCommandService } from './event-games-host-command.service';
import { EventGamesSessionPinService } from './game-session-pin.service';

const HOST_COMMAND_ACTIONS = {
  start: 'start_session',
  pause: 'pause_session',
  resume: 'resume_session',
  end: 'end_session',
  cancel: 'cancel_session',
  'disable-joins': 'disable_joins',
  'enable-joins': 'enable_joins',
} as const;

function roundAdvanceDetails(
  context: NonNullable<Awaited<ReturnType<GameSessionStorePort['getHostReadContext']>>>,
  requestedRoundKey: string,
  rules: GameRuleRegistryPort,
  now: Date,
) {
  if (!['live', 'paused'].includes(context.status) || !context.startedAt) {
    throw new ConflictException('Game round is not available to advance');
  }
  const roundTime = context.status === 'paused' ? context.pausedAt ?? now : now;
  const roundOffsetMs = context.roundOffsetMs ?? 0;
  const effectiveStart = new Date(context.startedAt.getTime() + context.totalPausedMs - roundOffsetMs);
  const round = rules.get(context.kind)?.getCurrentRound({
    configuration: context.configSnapshot,
    startedAt: effectiveStart,
    now: roundTime,
  });
  if (!round || round.key !== requestedRoundKey || round.number >= round.total || !round.deadlineAt) {
    throw new ConflictException('Game round is not available to advance');
  }
  const advanceByMs = round.deadlineAt.getTime() - roundTime.getTime();
  if (!Number.isSafeInteger(advanceByMs) || advanceByMs <= 0) {
    throw new ConflictException('Game round is not available to advance');
  }
  return { round, advanceByMs, roundOffsetMs, startedAt: context.startedAt };
}

@Injectable()
export class GameSessionService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_SESSION_STORE) private readonly store: GameSessionStorePort,
    @Optional() @Inject(GAME_RULES) private readonly rules: GameRuleRegistryPort | undefined,
    @Inject(GAME_AUDIT) private readonly audit: GameAuditPort,
    private readonly transactions: PrismTransactionRunner,
    private readonly hostCommands: EventGamesHostCommandService,
    @Optional() @Inject(GAME_SCHEDULER) private readonly scheduler: GameSchedulerPort | undefined,
    @Inject(EventGamesSessionPinService) private readonly sessionPins: EventGamesSessionPinService,
    @Optional() @Inject(GAME_ACTION_CLOCK) private readonly clock: () => Date = () => new Date(),
  ) {}

  async createHostSession(eventId: string, actor: PrismVerifiedEventActor, input: PrismCreateGameSessionInput) {
    await this.eventAccess.assertHostAccess(eventId, actor);

    const scheduledStartAt = input.scheduledStartAt ? new Date(input.scheduledStartAt) : null;
    if (scheduledStartAt && (!Number.isFinite(scheduledStartAt.getTime()) || scheduledStartAt.getTime() <= Date.now())) {
      throw new BadRequestException('Scheduled start must be a valid future time');
    }
    if (scheduledStartAt && !this.scheduler) {
      throw new ServiceUnavailableException('Durable game scheduling is not configured');
    }

    return this.transactions.run(
      (transaction) => this.persistNewSession(eventId, actor, input, scheduledStartAt, transaction),
      { actorId: actor.actorId },
    );
  }

  private async persistNewSession(
    eventId: string,
    actor: PrismVerifiedEventActor,
    input: PrismCreateGameSessionInput,
    scheduledStartAt: Date | null,
    transaction: PrismTransactionContext,
  ) {
    if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new ConflictException('Event games are closed');
    const definition = await this.store.findPublishedDefinitionForSession({ eventId, gameId: input.gameId }, transaction);
    if (!definition) throw new NotFoundException('Published game not found');
    const rule = this.rules?.get(definition.kind);
    if (!rule) throw new ConflictException('This game type is not ready to start');
    if (rule.validateConfiguration(definition.config).length > 0) {
      throw new ConflictException('Game configuration is incomplete');
    }
    this.assertScheduleWithinAvailability(definition, scheduledStartAt);

    const status = scheduledStartAt ? 'scheduled' : 'lobby';
    const created = await this.store.createHostSession({
      id: randomUUID(),
      eventId,
      gameId: definition.id,
      configVersionId: definition.configVersionId,
      configSnapshot: definition.config,
      entryMode: definition.entryMode,
      status,
      scheduledStartAt,
      createdBy: actor.actorId,
      startIdempotencyKey: randomUUID(),
    }, transaction);
    if (scheduledStartAt) {
      await this.scheduler!.schedule({ eventId, sessionId: created.id, startsAt: scheduledStartAt }, transaction);
    }
    await this.auditCreatedSession(eventId, actor, created.id, created.status, scheduledStartAt, transaction);
    return created;
  }

  private assertScheduleWithinAvailability(
    definition: { entryMode: string; availableFrom: Date | null; availableUntil: Date | null },
    scheduledStartAt: Date | null,
  ) {
    const outsideWindow = Boolean(
      scheduledStartAt && definition.entryMode === 'independent' &&
      ((definition.availableFrom && scheduledStartAt < definition.availableFrom) ||
        (definition.availableUntil && scheduledStartAt > definition.availableUntil)),
    );
    if (outsideWindow) throw new BadRequestException('Scheduled start is outside the configured game window');
  }

  private auditCreatedSession(
    eventId: string,
    actor: PrismVerifiedEventActor,
    sessionId: string,
    status: string,
    scheduledStartAt: Date | null,
    transaction: PrismTransactionContext,
  ) {
    return this.audit.recordHostWrite({
      eventId,
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: scheduledStartAt ? 'schedule_session' : 'create_session',
      resourceType: 'session',
      resourceId: sessionId,
      outcome: scheduledStartAt ? 'scheduled' : 'created',
      resultId: sessionId,
      requestReceiptId: randomUUID(),
      transition: {
        beforeStatus: null,
        afterStatus: status as 'scheduled' | 'lobby',
        beforeVersion: null,
        afterVersion: null,
      },
      timestamp: new Date(),
    }, transaction);
  }

  async executeHostCommand(
    eventId: string,
    sessionId: string,
    actor: PrismVerifiedEventActor,
    input: PrismGameHostCommandInput,
  ) {
    if (input.command === 'enable-joins') {
      return this.sessionPins.issueSessionPin(eventId, sessionId, actor, input);
    }
    if (input.command === 'spin-wheel') {
      return this.spinWheel(eventId, sessionId, actor, input);
    }
    if (input.command === 'advance-round') {
      return this.advanceRound(eventId, sessionId, actor, input);
    }
    return this.hostCommands.executeHostCommand({
      eventId,
      actor,
      resourceType: 'session',
      resourceId: sessionId,
      action: HOST_COMMAND_ACTIONS[input.command],
      command: { command: input.command, reason: input.reason },
      requestReceiptId: input.idempotencyKey,
    });
  }

  private async spinWheel(
    eventId: string,
    sessionId: string,
    actor: PrismVerifiedEventActor,
    input: PrismGameHostCommandInput,
  ) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    const context = await this.transactions.run(
      (transaction) => this.store.getHostReadContext({ eventId, sessionId }, transaction),
      { actorId: actor.actorId },
    );
    if (!context || context.kind !== 'spin-wheel') {
      throw new ConflictException('Spin the Wheel is not available for this session');
    }

    let result = context.wheelResult;
    if (!result) {
      if (context.status !== 'live') throw new ConflictException('Spin the Wheel is not ready');
      const rule = this.rules?.get('spin-wheel');
      if (!rule || rule.validateConfiguration(context.configSnapshot).length > 0) {
        throw new ConflictException('Spin the Wheel configuration is unavailable');
      }
      const selection = rule.scoreSubmission({ configuration: context.configSnapshot, submission: {} }).result;
      if (!selection || selection.kind !== 'spin-wheel') {
        throw new ConflictException('Spin the Wheel could not select an outcome');
      }
      result = selection;
    }

    return this.hostCommands.executeHostCommand({
      eventId,
      actor,
      resourceType: 'session',
      resourceId: sessionId,
      action: 'spin_wheel',
      command: { command: 'spin-wheel', wheelResult: result },
      requestReceiptId: input.idempotencyKey,
    });
  }

  private async advanceRound(
    eventId: string,
    sessionId: string,
    actor: PrismVerifiedEventActor,
    input: PrismGameHostCommandInput,
  ) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    if (!input.roundKey || !this.rules) throw new ConflictException('Game round is not available to advance');
    const context = await this.transactions.run(
      (transaction) => this.store.getHostReadContext({ eventId, sessionId }, transaction),
      { actorId: actor.actorId },
    );
    if (!context) throw new ConflictException('Game round is not available to advance');
    const { round, advanceByMs, roundOffsetMs, startedAt } = roundAdvanceDetails(context, input.roundKey, this.rules, this.clock());
    return this.hostCommands.executeHostCommand({
      eventId,
      actor,
      resourceType: 'session',
      resourceId: sessionId,
      action: 'advance_round',
      command: {
        expectedRoundKey: round.key,
        advanceByMs,
        expectedRoundOffsetMs: roundOffsetMs,
        expectedStatus: context.status,
        expectedStartedAt: startedAt.toISOString(),
        expectedPausedAt: context.pausedAt?.toISOString() ?? null,
        expectedTotalPausedMs: context.totalPausedMs,
      },
      requestReceiptId: input.idempotencyKey,
    });
  }

  async getHostState(eventId: string, sessionId: string, actor: PrismVerifiedEventActor) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      const state = await this.store.getHostState({ eventId, sessionId }, transaction);
      if (!state) throw new NotFoundException('Game session not found');
      return state;
    }, { actorId: actor.actorId });
  }
}
