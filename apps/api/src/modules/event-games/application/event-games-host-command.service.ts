import { ConflictException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { GAME_AUDIT, type GameAuditPort } from '../contracts/game-audit.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import {
  GAME_PERSISTENCE,
  type GameHostAction,
  type GamePersistencePort,
  type GameResourceType,
  type PersistedGameHostCommand,
} from '../contracts/game-persistence.port';

export interface EventGamesHostCommand {
  eventId: string;
  actor: PrismVerifiedEventActor;
  resourceType: GameResourceType;
  resourceId: string;
  action: GameHostAction;
  command: Readonly<Record<string, unknown>>;
  requestReceiptId: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

function payloadHash(input: EventGamesHostCommand): string {
  const payload = canonicalize({
    eventId: input.eventId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    action: input.action,
    // The server-generated weighted selection can differ between retries; the
    // request identity is the host command itself, not the random result.
    command: input.action === 'spin_wheel' ? { command: 'spin-wheel' } : input.command,
  });
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

@Injectable()
export class EventGamesHostCommandService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Optional() @Inject(GAME_PERSISTENCE) private readonly persistence: GamePersistencePort | undefined,
    @Inject(GAME_AUDIT) private readonly audit: GameAuditPort,
    private readonly workflowCommands: WorkflowCommandService,
  ) {}

  async executeHostCommand(input: EventGamesHostCommand) {
    const persistence = this.persistence;
    return this.workflowCommands.execute<PersistedGameHostCommand>({
      name: 'event_game_host_command',
      eventId: input.eventId,
      sideEffectMode: 'same_tx',
      idempotencyPayloadHash: payloadHash(input),
      context: {
        actorId: input.actor.actorId,
        actorRole: input.actor.actorRole,
        eventId: input.eventId,
        correlationId: `event_game_host_command_${randomUUID()}`,
        idempotencyKey: input.requestReceiptId,
      },
      validatePermission: () => this.eventAccess.assertHostAccess(input.eventId, input.actor),
      write: async (transaction) => {
        if (!transaction) {
          throw new ServiceUnavailableException('Transactional game command context is unavailable');
        }
        if (!persistence) {
          throw new ServiceUnavailableException('Event game persistence is not configured');
        }
        if (!(await this.eventAccess.isEventOpen(input.eventId, transaction))) {
          throw new ConflictException('Event games are closed');
        }

        const persisted = await persistence.executeHostCommand(
          {
            eventId: input.eventId,
            actorId: input.actor.actorId,
            resourceType: input.resourceType,
            resourceId: input.resourceId,
            action: input.action,
            command: input.command,
            requestReceiptId: input.requestReceiptId,
          },
          transaction,
        );

        if (
          persisted.eventId !== input.eventId ||
          persisted.resourceType !== input.resourceType ||
          persisted.resourceId !== input.resourceId ||
          persisted.action !== input.action ||
          persisted.requestReceiptId !== input.requestReceiptId
        ) {
          throw new ConflictException('Persisted event game command scope did not match the request');
        }

        await this.audit.recordHostWrite(
          {
            eventId: persisted.eventId,
            actorId: input.actor.actorId,
            actorRole: input.actor.actorRole,
            action: persisted.action,
            resourceType: persisted.resourceType,
            resourceId: persisted.resourceId,
            outcome: persisted.outcome,
            resultId: persisted.resultId,
            requestReceiptId: persisted.requestReceiptId,
            transition: persisted.transition,
            timestamp: new Date(),
          },
          transaction,
        );

        return persisted;
      },
    });
  }
}
