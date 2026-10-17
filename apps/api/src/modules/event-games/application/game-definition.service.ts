import { ConflictException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismTransactionRunner, type PrismTransactionContext } from '@prism/kernel/shared-kernel';
import {
  eventGameTemplateConfigurationSchema,
  eventGameMediaObjectIdsSchema,
  type PrismCreateEventGameInput,
  type PrismUpdateEventGameInput,
  type RequestEventGameMediaUploadInput,
  type PrismVerifiedEventActor,
} from '@prism/types';
import { GAME_AUDIT, type GameAuditPort } from '../contracts/game-audit.port';
import { GAME_EVENT_ACCESS, type GameEventAccessPort } from '../contracts/game-event-access.port';
import {
  GAME_DEFINITION_STORE,
  type GameDefinitionEntryMode,
  type GameDefinitionRecord,
  type GameDefinitionStorePort,
} from '../contracts/game-definition-store.port';
import { GAME_RULES, type GameRuleRegistryPort } from '../contracts/game-rule.port';
import { GAME_MEDIA_STORAGE, type GameMediaStoragePort } from '../contracts/game-media-storage.port';
import { GAME_PIN_STORE, type GamePinStorePort } from '../contracts/game-pin-store.port';

const INDEPENDENT_GAME_KINDS = new Set([
  'word-scramble',
  'would-you-rather',
  'guess-picture-solo',
  'this-or-that-solo',
  'spot-the-difference',
]);

function entryModeFor(kind: PrismCreateEventGameInput['kind']): GameDefinitionEntryMode {
  return INDEPENDENT_GAME_KINDS.has(kind) ? 'independent' : 'active';
}

function slugFor(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'game';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function draftAvailability(input: PrismUpdateEventGameInput, existing: GameDefinitionRecord) {
  const availableFrom = input.availableFrom !== undefined ? new Date(input.availableFrom) : existing.availableFrom;
  const availableUntil = input.availableUntil !== undefined ? new Date(input.availableUntil) : existing.availableUntil;
  if (availableFrom && availableUntil && availableUntil.getTime() <= availableFrom.getTime()) {
    throw new ConflictException('Game availability end must be after its start');
  }
  return { availableFrom, availableUntil };
}

function mergeDraftConfig(existing: GameDefinitionRecord, input: PrismUpdateEventGameInput) {
  const configured = input.configuration ?? existing.config.configuration;
  const requiredMediaIds = configuredMediaObjectIdsFor(configured);
  const mediaObjectIds = input.mediaObjectIds
    ?? (input.configuration !== undefined
      ? requiredMediaIds
      : existing.config.mediaObjectIds ?? (requiredMediaIds.length ? requiredMediaIds : undefined));
  return {
    ...existing.config,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
    ...(mediaObjectIds !== undefined ? { mediaObjectIds } : {}),
    ...(input.configuration !== undefined ? { configuration: input.configuration } : {}),
  };
}

function configuredMediaObjectIdsFor(configuration: unknown): string[] {
  const parsed = eventGameTemplateConfigurationSchema.safeParse(configuration);
  if (!parsed.success) return [];
  if (parsed.data.kind === 'guess-picture') return [parsed.data.mediaObjectId];
  if (parsed.data.kind === 'guess-picture-solo') return uniqueMediaIds(parsed.data.rounds.map(({ mediaObjectId }) => mediaObjectId));
  if (parsed.data.kind === 'spot-the-difference') {
    return uniqueMediaIds(parsed.data.rounds.flatMap(({ originalMediaObjectId, comparisonMediaObjectId }) =>
      [originalMediaObjectId, comparisonMediaObjectId]));
  }
  return [];
}

function uniqueMediaIds(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function sameMediaIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && new Set(left).size === left.length
    && left.every((value) => right.includes(value));
}

function assertConfigurationMatchesKind(existing: GameDefinitionRecord, input: PrismUpdateEventGameInput) {
  if (input.configuration && input.configuration.kind !== existing.kind) {
    throw new ConflictException('Game configuration must match the selected template');
  }
  const requiredMediaIds = configuredMediaObjectIdsFor(input.configuration ?? existing.config.configuration);
  if (requiredMediaIds.length && input.mediaObjectIds !== undefined
    && !sameMediaIds(input.mediaObjectIds, requiredMediaIds)) {
    throw new ConflictException('Game media references must match the configured images');
  }
}

function shouldValidateMediaReferences(input: PrismUpdateEventGameInput): boolean {
  return input.mediaObjectIds !== undefined
    || (input.configuration !== undefined && configuredMediaObjectIdsFor(input.configuration).length > 0);
}

@Injectable()
export class GameDefinitionService {
  constructor(
    @Inject(GAME_EVENT_ACCESS) private readonly eventAccess: GameEventAccessPort,
    @Inject(GAME_DEFINITION_STORE) private readonly store: GameDefinitionStorePort,
    @Inject(GAME_AUDIT) private readonly audit: GameAuditPort,
    private readonly transactions: PrismTransactionRunner,
    @Optional() @Inject(GAME_RULES) private readonly rules?: GameRuleRegistryPort,
    @Optional() @Inject(GAME_MEDIA_STORAGE) private readonly mediaStorage?: GameMediaStoragePort,
    @Optional() @Inject(GAME_PIN_STORE) private readonly pinStore?: GamePinStorePort,
  ) {}

  async listForEvent(eventId: string, actor: PrismVerifiedEventActor) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run((transaction) => this.store.listForEvent(eventId, transaction), { actorId: actor.actorId });
  }

  async getForEvent(eventId: string, gameId: string, actor: PrismVerifiedEventActor) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      const game = await this.store.findForEvent({ eventId, gameId }, transaction);
      if (!game || game.status === 'removed') throw new NotFoundException('Game not found');
      return game;
    }, { actorId: actor.actorId });
  }

  async createDraft(eventId: string, actor: PrismVerifiedEventActor, input: PrismCreateEventGameInput) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new ConflictException('Event games are closed');
      const created = await this.store.createDraft({
        id: randomUUID(),
        eventId,
        slug: slugFor(input.title),
        title: input.title,
        kind: input.kind,
        entryMode: entryModeFor(input.kind),
        status: 'draft',
        createdBy: actor.actorId,
        version: 1,
        config: {
          description: input.description ?? '',
          instructions: input.instructions ?? '',
          ...(input.configuration ? { configuration: input.configuration } : {}),
          ...(input.configuration ? { mediaObjectIds: configuredMediaObjectIdsFor(input.configuration) } : {}),
        },
        availableFrom: input.availableFrom ? new Date(input.availableFrom) : null,
        availableUntil: input.availableUntil ? new Date(input.availableUntil) : null,
      }, transaction);

      await this.audit.recordHostWrite({
        eventId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: 'create_game',
        resourceType: 'definition',
        resourceId: created.id,
        outcome: 'created',
        resultId: created.id,
        requestReceiptId: randomUUID(),
        transition: { beforeStatus: null, afterStatus: 'draft', beforeVersion: null, afterVersion: created.version },
        timestamp: new Date(),
      }, transaction);

      return created;
    });
  }

  async updateDraft(
    eventId: string,
    gameId: string,
    actor: PrismVerifiedEventActor,
    input: PrismUpdateEventGameInput,
  ) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new ConflictException('Event games are closed');
      const existing = await this.store.findDraftForUpdate({ eventId, gameId }, transaction);
      if (!existing) {
        throw new NotFoundException('Game draft not found');
      }
      if (existing.status !== 'draft' && existing.status !== 'published') {
        throw new NotFoundException('Game draft not found');
      }
      assertConfigurationMatchesKind(existing, input);

      const { availableFrom, availableUntil } = draftAvailability(input, existing);

      const nextConfig = mergeDraftConfig(existing, input);
      const nextMediaObjectIds = eventGameMediaObjectIdsSchema.safeParse(nextConfig.mediaObjectIds ?? []);
      if (!nextMediaObjectIds.success) throw new ConflictException('Game media configuration is invalid');
      if (shouldValidateMediaReferences(input)) {
        await this.validateMediaReferences(eventId, gameId, nextMediaObjectIds.data, transaction);
      }

      const updated = await this.store.appendDraftVersion({
        eventId,
        gameId,
        actorId: actor.actorId,
        status: existing.status,
        title: input.title ?? existing.title,
        version: existing.version + 1,
        config: nextConfig,
        availableFrom,
        availableUntil,
      }, transaction);

      await this.audit.recordHostWrite({
        eventId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: 'update_game',
        resourceType: 'definition',
        resourceId: updated.id,
        outcome: 'updated',
        resultId: updated.id,
        requestReceiptId: randomUUID(),
        transition: {
          beforeStatus: existing.status,
          afterStatus: updated.status,
          beforeVersion: existing.version,
          afterVersion: updated.version,
        },
        timestamp: new Date(),
      }, transaction);

      return updated;
    });
  }

  private async validateMediaReferences(
    eventId: string,
    gameId: string,
    objectIds: string[],
    transaction: PrismTransactionContext,
  ): Promise<void> {
    if (objectIds.length === 0) return;
    if (!this.mediaStorage) throw new ServiceUnavailableException('Game media storage is unavailable');
    await this.mediaStorage.validateReferences({ eventId, gameId, objectIds }, transaction);
  }

  async requestGameMediaUpload(
    eventId: string,
    gameId: string,
    actor: PrismVerifiedEventActor,
    request: RequestEventGameMediaUploadInput,
  ) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new ConflictException('Event games are closed');
      const game = await this.store.findDraftForUpdate({ eventId, gameId }, transaction);
      if (!game) throw new NotFoundException('Game draft not found');
      if (!this.mediaStorage) throw new ServiceUnavailableException('Game media storage is unavailable');
      return this.mediaStorage.requestGameMediaUpload({ eventId, gameId, actor, request }, transaction);
    }, { actorId: actor.actorId });
  }

  async confirmGameMediaUpload(
    eventId: string,
    gameId: string,
    objectId: string,
    actor: PrismVerifiedEventActor,
    confirmation: { checksumSha256: string; byteSize: number },
  ) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new ConflictException('Event games are closed');
      const game = await this.store.findDraftForUpdate({ eventId, gameId }, transaction);
      if (!game) throw new NotFoundException('Game draft not found');
      if (!this.mediaStorage) throw new ServiceUnavailableException('Game media storage is unavailable');
      return this.mediaStorage.confirmGameMediaUpload({ eventId, gameId, objectId, actor, confirmation }, transaction);
    }, { actorId: actor.actorId });
  }

  async removeUnstartedGame(eventId: string, gameId: string, actor: PrismVerifiedEventActor) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new ConflictException('Event games are closed');
      const removed = await this.store.removeUnstartedGame({ eventId, gameId, actorId: actor.actorId }, transaction);
      if (!removed) {
        throw new NotFoundException('Game not found or already started');
      }
      for (const sessionId of removed.cancelledSessionIds ?? []) {
        await this.pinStore?.revokeSessionPin({
          eventId,
          sessionId,
          actorId: actor.actorId,
          now: new Date(),
          reason: 'closed',
        }, transaction);
      }

      await this.audit.recordHostWrite({
        eventId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: 'remove_game',
        resourceType: 'definition',
        resourceId: removed.game.id,
        outcome: 'removed',
        resultId: removed.game.id,
        requestReceiptId: randomUUID(),
        transition: {
          beforeStatus: removed.beforeStatus,
          afterStatus: removed.game.status,
          beforeVersion: removed.beforeVersion,
          afterVersion: removed.game.version,
        },
        timestamp: new Date(),
      }, transaction);

      return removed.game;
    });
  }

  async publishDraft(eventId: string, gameId: string, actor: PrismVerifiedEventActor) {
    await this.eventAccess.assertHostAccess(eventId, actor);
    return this.transactions.run(async (transaction) => {
      if (!(await this.eventAccess.isEventOpen(eventId, transaction))) throw new ConflictException('Event games are closed');
      const existing = await this.store.findDraftForUpdate({ eventId, gameId }, transaction);
      if (!existing) {
        throw new NotFoundException('Game draft not found');
      }
      if (existing.status !== 'draft') throw new ConflictException('Only a draft game can be published');

      const rule = this.rules?.get(existing.kind);
      if (!rule) {
        throw new ConflictException('This game type is not ready to publish');
      }
      const configurationErrors = rule.validateConfiguration(existing.config);
      if (configurationErrors.length > 0) {
        throw new ConflictException('Game configuration is incomplete');
      }

      const mediaObjectIds = eventGameMediaObjectIdsSchema.safeParse(existing.config.mediaObjectIds ?? []);
      if (!mediaObjectIds.success) {
        throw new ConflictException('Game media configuration is invalid');
      }
      await this.validateMediaReferences(eventId, gameId, mediaObjectIds.data, transaction);

      const published = await this.store.publishDraft(
        { eventId, gameId, actorId: actor.actorId, expectedVersion: existing.version },
        transaction,
      );
      if (!published) {
        throw new ConflictException('Game draft changed before it could be published');
      }

      await this.audit.recordHostWrite({
        eventId,
        actorId: actor.actorId,
        actorRole: actor.actorRole,
        action: 'publish_game',
        resourceType: 'definition',
        resourceId: published.game.id,
        outcome: 'published',
        resultId: published.game.id,
        requestReceiptId: randomUUID(),
        transition: {
          beforeStatus: published.beforeStatus,
          afterStatus: published.game.status,
          beforeVersion: published.beforeVersion,
          afterVersion: published.game.version,
        },
        timestamp: new Date(),
      }, transaction);

      return published.game;
    });
  }
}
