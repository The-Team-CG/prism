import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor, PrismCreateEventGameInput, PrismUpdateEventGameInput, RequestEventGameMediaUploadInput } from '@prism/types';
import { describe, expect, it, vi } from 'vitest';
import { GameDefinitionService } from './game-definition.service';

const eventId = 'event-1';
const gameId = 'game-1';

function actor(overrides: Partial<PrismVerifiedEventActor> = {}): PrismVerifiedEventActor {
  return {
    id: 'actor-1',
    actorId: 'actor-1',
    role: 'coordinator',
    actorRole: 'coordinator',
    email: 'coordinator@example.test',
    actorEmail: 'coordinator@example.test',
    name: 'Coordinator',
    actorName: 'Coordinator',
    expiresAt: '2030-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createDefinitionService(overrides: {
  access?: { assertHostAccess: ReturnType<typeof vi.fn>; isEventOpen?: ReturnType<typeof vi.fn> };
  store?: Record<string, ReturnType<typeof vi.fn>>;
  audit?: { recordHostWrite: ReturnType<typeof vi.fn> };
  rules?: { get: ReturnType<typeof vi.fn> };
  mediaStorage?: {
    validateReferences: ReturnType<typeof vi.fn>;
    requestGameMediaUpload?: ReturnType<typeof vi.fn>;
    confirmGameMediaUpload?: ReturnType<typeof vi.fn>;
  };
} = {}) {
  const transaction = {
    prisma: {},
    correlationId: 'game-definition-test',
    actorId: 'actor-1',
  } as PrismTransactionContext;
  const transactions = {
    run: vi.fn(async (work: (context: PrismTransactionContext) => Promise<unknown>) => work(transaction)),
  };
  const access = overrides.access ?? {
    assertHostAccess: vi.fn().mockResolvedValue(undefined),
    isEventOpen: vi.fn().mockResolvedValue(true),
  };
  const store = overrides.store ?? {
    createDraft: vi.fn(async (input: Record<string, unknown>) => ({
      ...input,
      id: 'game-created',
      version: 1,
    })),
    findDraftForUpdate: vi.fn().mockResolvedValue({
      id: gameId,
      eventId,
      kind: 'live-trivia',
      entryMode: 'active',
      status: 'draft',
      title: 'Trivia',
      version: 1,
      config: { description: 'Original description', instructions: 'Original instructions' },
    }),
    appendDraftVersion: vi.fn(async (input: Record<string, unknown>) => ({
      id: gameId,
      ...input,
      version: 2,
    })),
    removeUnstartedGame: vi.fn().mockResolvedValue({
      game: {
        id: gameId,
        eventId,
        kind: 'live-trivia',
        entryMode: 'active',
        status: 'removed',
        title: 'Trivia',
        version: 1,
        config: { description: 'Original description', instructions: 'Original instructions' },
      },
      beforeStatus: 'draft',
      beforeVersion: 1,
    }),
    publishDraft: vi.fn().mockResolvedValue({
      game: {
        id: gameId,
        eventId,
        kind: 'live-trivia',
        entryMode: 'active',
        status: 'published',
        title: 'Trivia',
        version: 1,
        config: { description: 'Original description', instructions: 'Original instructions' },
      },
      beforeStatus: 'draft',
      beforeVersion: 1,
    }),
    listForEvent: vi.fn().mockResolvedValue([]),
    findForEvent: vi.fn().mockResolvedValue({
      id: gameId,
      eventId,
      kind: 'live-trivia',
      entryMode: 'active',
      status: 'draft',
      title: 'Trivia',
      version: 1,
      config: { description: 'Original description', instructions: 'Original instructions' },
    }),
  };
  const audit = overrides.audit ?? { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
  const rules = overrides.rules ?? { get: vi.fn().mockReturnValue(undefined) };
  const mediaStorage = overrides.mediaStorage ?? { validateReferences: vi.fn().mockResolvedValue(undefined) };
  const ServiceConstructor = GameDefinitionService as unknown as new (...args: unknown[]) => GameDefinitionService;
  return {
    service: new ServiceConstructor(access, store, audit, transactions, rules, mediaStorage),
    access,
    store,
    audit,
    transactions,
    transaction,
    rules,
    mediaStorage,
  };
}

describe('GameDefinitionService', () => {
  it('creates an event-scoped draft and writes its creation audit in the same transaction', async () => {
    const { service, access, store, audit, transaction } = createDefinitionService();
    const input: PrismCreateEventGameInput = {
      kind: 'live-trivia',
      title: 'Opening Trivia',
      description: 'A short event opener',
      instructions: 'Choose one answer per round',
    };

    const result = await service.createDraft(eventId, actor(), input);

    expect(result).toMatchObject({ id: 'game-created', eventId, kind: 'live-trivia', entryMode: 'active', status: 'draft', version: 1 });
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, expect.objectContaining({ actorId: 'actor-1' }));
    expect(store.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId,
        createdBy: 'actor-1',
        kind: 'live-trivia',
        entryMode: 'active',
        status: 'draft',
        version: 1,
        config: { description: 'A short event opener', instructions: 'Choose one answer per round' },
      }),
      transaction,
    );
    expect(audit.recordHostWrite).toHaveBeenCalledWith(
      expect.objectContaining({ eventId, action: 'create_game', resourceType: 'definition', resourceId: 'game-created' }),
      transaction,
    );
  });

  it('stores a strict template configuration inside the versioned draft configuration', async () => {
    const { service, store } = createDefinitionService();
    const configuration = {
      kind: 'live-trivia' as const,
      rounds: [{
        key: 'q1', prompt: 'Pick one', options: ['A', 'B'], correctAnswer: 'B',
        points: 100, durationSeconds: 30,
      }],
    };

    await service.createDraft(eventId, actor(), {
      kind: 'live-trivia', title: 'Opening Trivia', configuration,
    });

    expect(store.createDraft).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ configuration }),
    }), expect.any(Object));
  });

  it('updates only a draft in the requested event by appending a new immutable configuration version', async () => {
    const { service, access, store, audit, transaction } = createDefinitionService();
    const input: PrismUpdateEventGameInput = { description: 'Revised description' };

    const result = await service.updateDraft(eventId, gameId, actor(), input);

    expect(result).toMatchObject({ id: gameId, eventId, version: 2, status: 'draft' });
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventId, expect.objectContaining({ actorId: 'actor-1' }));
    expect(store.findDraftForUpdate).toHaveBeenCalledWith({ eventId, gameId }, transaction);
    expect(store.appendDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId,
        gameId,
        actorId: 'actor-1',
        title: 'Trivia',
        version: 2,
        config: { description: 'Revised description', instructions: 'Original instructions' },
      }),
      transaction,
    );
    expect(audit.recordHostWrite).toHaveBeenCalledWith(
      expect.objectContaining({ eventId, action: 'update_game', resourceId: gameId }),
      transaction,
    );
  });
  it('validates event-owned media references before appending a draft version', async () => {
    const mediaObjectIds = ['obj_00000000-0000-4000-8000-000000000101'];
    const { service, store, mediaStorage, transaction } = createDefinitionService();

    await service.updateDraft(eventId, gameId, actor(), { mediaObjectIds });

    expect(mediaStorage.validateReferences).toHaveBeenCalledWith(
      { eventId, gameId, objectIds: mediaObjectIds },
      transaction,
    );
    expect(store.appendDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ mediaObjectIds }) }),
      transaction,
    );
  });

  it('links a picture template to its event-owned media object before saving the draft version', async () => {
    const mediaObjectId = 'obj_00000000-0000-4000-8000-000000000101';
    const { service, store, mediaStorage, transaction } = createDefinitionService();
    const configuration = {
      kind: 'guess-picture' as const,
      mediaObjectId,
      acceptedAnswers: ['a cat'],
      stages: [{ afterSeconds: 0, hint: 'Look closely', points: 100 }],
    };
    store.findDraftForUpdate.mockResolvedValue({
      id: gameId, eventId, kind: 'guess-picture', entryMode: 'active', status: 'draft',
      title: 'Picture', version: 1, config: { description: '', instructions: '' },
    });

    await service.updateDraft(eventId, gameId, actor(), { configuration });

    expect(mediaStorage.validateReferences).toHaveBeenCalledWith({ eventId, gameId, objectIds: [mediaObjectId] }, transaction);
    expect(store.appendDraftVersion).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ configuration, mediaObjectIds: [mediaObjectId] }),
    }), transaction);
  });

  it('links and validates every Singleplayer picture and comparison image from its strict configuration', async () => {
    const mediaA = 'obj_00000000-0000-4000-8000-000000000101';
    const mediaB = 'obj_00000000-0000-4000-8000-000000000102';
    const { service, store, mediaStorage, transaction } = createDefinitionService();
    store.findDraftForUpdate.mockResolvedValue({
      id: gameId, eventId, kind: 'spot-the-difference', entryMode: 'independent', status: 'draft',
      title: 'Find the differences', version: 1, config: { description: '', instructions: '' },
    });
    const configuration = {
      kind: 'spot-the-difference' as const,
      rounds: [{
        key: 'differences-1', originalMediaObjectId: mediaA, comparisonMediaObjectId: mediaB, durationSeconds: 90,
        differences: [{ x: 0.2, y: 0.3, width: 0.1, height: 0.1, points: 10 }],
      }],
    };

    await service.updateDraft(eventId, gameId, actor(), { configuration });

    expect(mediaStorage.validateReferences).toHaveBeenCalledWith({ eventId, gameId, objectIds: [mediaA, mediaB] }, transaction);
    expect(store.appendDraftVersion).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ configuration, mediaObjectIds: [mediaA, mediaB] }),
    }), transaction);
  });

  it('rejects Singleplayer media lists that do not match all configured images', async () => {
    const mediaA = 'obj_00000000-0000-4000-8000-000000000101';
    const mediaB = 'obj_00000000-0000-4000-8000-000000000102';
    const { service, store, audit } = createDefinitionService();
    store.findDraftForUpdate.mockResolvedValue({
      id: gameId, eventId, kind: 'spot-the-difference', entryMode: 'independent', status: 'draft',
      title: 'Find the differences', version: 1, config: { description: '', instructions: '' },
    });

    await expect(service.updateDraft(eventId, gameId, actor(), {
      mediaObjectIds: [mediaA],
      configuration: {
        kind: 'spot-the-difference',
        rounds: [{
          key: 'differences-1', originalMediaObjectId: mediaA, comparisonMediaObjectId: mediaB, durationSeconds: 90,
          differences: [{ x: 0.2, y: 0.3, width: 0.1, height: 0.1, points: 10 }],
        }],
      },
    })).rejects.toBeInstanceOf(ConflictException);
    expect(store.appendDraftVersion).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('rejects a template configuration from another game kind before persistence', async () => {
    const { service, store, audit } = createDefinitionService();
    const wrongConfiguration = {
      kind: 'bingo' as const,
      callSequence: Array.from({ length: 24 }, (_, index) => index + 1),
      callIntervalSeconds: 10,
      winPattern: 'line' as const,
      points: 100,
    };

    await expect(service.updateDraft(eventId, gameId, actor(), { configuration: wrongConfiguration }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(store.appendDraftVersion).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('does not persist or audit a draft when a referenced asset is not owned by its event game', async () => {
    const mediaStorage = { validateReferences: vi.fn().mockRejectedValue(new NotFoundException()) };
    const { service, store, audit } = createDefinitionService({ mediaStorage });

    await expect(service.updateDraft(eventId, gameId, actor(), {
      mediaObjectIds: ['obj_00000000-0000-4000-8000-000000000101'],
    })).rejects.toBeInstanceOf(NotFoundException);

    expect(store.appendDraftVersion).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('rejects a PATCH whose merged availability window is reversed after timezone normalization', async () => {
    const { service, store, audit } = createDefinitionService();
    store.findDraftForUpdate.mockResolvedValue({
      id: gameId,
      eventId,
      kind: 'word-scramble',
      entryMode: 'independent',
      status: 'draft',
      title: 'Scramble',
      version: 1,
      config: {},
      availableFrom: new Date('2026-10-16T10:00:00.000Z'),
      availableUntil: new Date('2026-10-16T11:00:00.000Z'),
    });

    await expect(service.updateDraft(eventId, gameId, actor(), {
      availableUntil: '2026-10-16T10:30:00+02:00',
    })).rejects.toBeInstanceOf(ConflictException);

    expect(store.appendDraftVersion).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('does not reveal or update a draft outside the requested event scope', async () => {
    const store = {
      createDraft: vi.fn(),
      findDraftForUpdate: vi.fn().mockResolvedValue(null),
      appendDraftVersion: vi.fn(),
    };
    const { service, audit } = createDefinitionService({ store });

    await expect(service.updateDraft(eventId, 'another-event-game', actor(), { title: 'Changed' }))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(store.findDraftForUpdate).toHaveBeenCalledWith({ eventId, gameId: 'another-event-game' }, expect.any(Object));
    expect(store.appendDraftVersion).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('does not create a draft or audit when host access is denied', async () => {
    const access = { assertHostAccess: vi.fn().mockRejectedValue(new ForbiddenException('Host access required')) };
    const store = {
      createDraft: vi.fn(),
      findDraftForUpdate: vi.fn(),
      appendDraftVersion: vi.fn(),
    };
    const { service, audit } = createDefinitionService({ access, store });

    await expect(service.createDraft(eventId, actor({ actorRole: 'guest', role: 'guest' }), {
      kind: 'live-trivia',
      title: 'Unauthorized Draft',
    })).rejects.toBeInstanceOf(ForbiddenException);

    expect(access.assertHostAccess).toHaveBeenCalledTimes(1);
    expect(store.createDraft).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('removes an unstarted game in the requested event and records its persisted transition', async () => {
    const { service, store, audit, transaction } = createDefinitionService();

    const result = await service.removeUnstartedGame(eventId, gameId, actor());

    expect(result).toMatchObject({ id: gameId, eventId, status: 'removed' });
    expect(store.removeUnstartedGame).toHaveBeenCalledWith({ eventId, gameId, actorId: 'actor-1' }, transaction);
    expect(audit.recordHostWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId,
        action: 'remove_game',
        resourceType: 'definition',
        resourceId: gameId,
        outcome: 'removed',
        transition: { beforeStatus: 'draft', afterStatus: 'removed', beforeVersion: 1, afterVersion: 1 },
      }),
      transaction,
    );
  });

  it('does not remove or audit a game that has a session or is outside the event', async () => {
    const store = {
      createDraft: vi.fn(),
      findDraftForUpdate: vi.fn(),
      appendDraftVersion: vi.fn(),
      removeUnstartedGame: vi.fn().mockResolvedValue(null),
    };
    const { service, audit } = createDefinitionService({ store });

    await expect(service.removeUnstartedGame(eventId, 'scoped-game', actor()))
      .rejects.toBeInstanceOf(NotFoundException);

    expect(store.removeUnstartedGame).toHaveBeenCalledWith(
      { eventId, gameId: 'scoped-game', actorId: 'actor-1' },
      expect.any(Object),
    );
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('rejects publishing a game kind without an approved rule', async () => {
    const { service, store, audit, rules } = createDefinitionService();

    await expect(service.publishDraft(eventId, gameId, actor())).rejects.toBeInstanceOf(ConflictException);

    expect(rules.get).toHaveBeenCalledWith('live-trivia');
    expect(store.publishDraft).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('publishes a valid draft through the rule port and audits the persisted status transition', async () => {
    const rule = { validateConfiguration: vi.fn().mockReturnValue([]) };
    const { service, store, audit, rules, transaction } = createDefinitionService({
      rules: { get: vi.fn().mockReturnValue(rule) },
    });

    const result = await service.publishDraft(eventId, gameId, actor());

    expect(result).toMatchObject({ id: gameId, eventId, status: 'published', version: 1 });
    expect(rules.get).toHaveBeenCalledWith('live-trivia');
    expect(rule.validateConfiguration).toHaveBeenCalledWith({
      description: 'Original description',
      instructions: 'Original instructions',
    });
    expect(store.publishDraft).toHaveBeenCalledWith({ eventId, gameId, actorId: 'actor-1', expectedVersion: 1 }, transaction);
    expect(audit.recordHostWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'publish_game',
        resourceId: gameId,
        outcome: 'published',
        transition: { beforeStatus: 'draft', afterStatus: 'published', beforeVersion: 1, afterVersion: 1 },
      }),
      transaction,
    );
  });

  it('revalidates stored media references before publishing a draft', async () => {
    const mediaObjectIds = ['obj_00000000-0000-4000-8000-000000000101'];
    const rule = { validateConfiguration: vi.fn().mockReturnValue([]) };
    const { service, store, mediaStorage, transaction } = createDefinitionService({
      rules: { get: vi.fn().mockReturnValue(rule) },
    });
    store.findDraftForUpdate.mockResolvedValue({
      id: gameId,
      eventId,
      kind: 'live-trivia',
      entryMode: 'active',
      status: 'draft',
      title: 'Trivia',
      version: 1,
      config: { description: '', instructions: '', mediaObjectIds },
    });

    await service.publishDraft(eventId, gameId, actor());

    expect(mediaStorage.validateReferences).toHaveBeenCalledWith(
      { eventId, gameId, objectIds: mediaObjectIds },
      transaction,
    );
    expect(mediaStorage.validateReferences.mock.invocationCallOrder[0])
      .toBeLessThan(store.publishDraft.mock.invocationCallOrder[0]);
  });

  it('requests game image uploads only for an editable game in an open event', async () => {
    const request: RequestEventGameMediaUploadInput = {
      fileName: 'clue.png', contentType: 'image/png', declaredByteSize: 512,
      checksumSha256: 'a'.repeat(64), idempotencyKey: '00000000-0000-4000-8000-000000000101',
    };
    const requestGameMediaUpload = vi.fn().mockResolvedValue({
      objectId: 'obj_00000000-0000-4000-8000-000000000107',
      uploadUrl: 'https://storage.example.test/upload', expiresAt: '2026-10-17T04:15:00.000Z', alreadyStored: false,
    });
    const mediaStorage = { validateReferences: vi.fn(), requestGameMediaUpload };
    const { service, store, transaction } = createDefinitionService({ mediaStorage });

    await expect(service.requestGameMediaUpload(eventId, gameId, actor(), request)).resolves.toMatchObject({
      objectId: 'obj_00000000-0000-4000-8000-000000000107',
    });

    expect(store.findDraftForUpdate).toHaveBeenCalledWith({ eventId, gameId }, transaction);
    expect(requestGameMediaUpload).toHaveBeenCalledWith({ eventId, gameId, actor: actor(), request }, transaction);
  });

  it('does not request game media for a closed event or an unavailable game draft', async () => {
    const request = {
      fileName: 'clue.png', contentType: 'image/png', declaredByteSize: 512,
      checksumSha256: 'a'.repeat(64), idempotencyKey: '00000000-0000-4000-8000-000000000101',
    } as RequestEventGameMediaUploadInput;
    const requestGameMediaUpload = vi.fn();
    const closedAccess = { assertHostAccess: vi.fn(), isEventOpen: vi.fn().mockResolvedValue(false) };
    const closed = createDefinitionService({
      access: closedAccess,
      mediaStorage: { validateReferences: vi.fn(), requestGameMediaUpload },
    });
    await expect(closed.service.requestGameMediaUpload(eventId, gameId, actor(), request))
      .rejects.toBeInstanceOf(ConflictException);
    expect(requestGameMediaUpload).not.toHaveBeenCalled();

    const unavailableGame = createDefinitionService({
      mediaStorage: { validateReferences: vi.fn(), requestGameMediaUpload },
      store: {
        createDraft: vi.fn(), findForEvent: vi.fn(), listForEvent: vi.fn(), findDraftForUpdate: vi.fn().mockResolvedValue(null),
        appendDraftVersion: vi.fn(), removeUnstartedGame: vi.fn(), publishDraft: vi.fn(),
      },
    });
    await expect(unavailableGame.service.requestGameMediaUpload(eventId, gameId, actor(), request))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(requestGameMediaUpload).not.toHaveBeenCalled();
  });

  it('lists games only for the authorized event', async () => {
    const { service, store, transaction } = createDefinitionService();

    await service.listForEvent(eventId, actor());

    expect(store.listForEvent).toHaveBeenCalledWith(eventId, transaction);
  });

  it('does not return a game when the requested event does not own its id', async () => {
    const store = {
      createDraft: vi.fn(), findDraftForUpdate: vi.fn(), appendDraftVersion: vi.fn(),
      removeUnstartedGame: vi.fn(), publishDraft: vi.fn(), listForEvent: vi.fn(),
      findForEvent: vi.fn().mockResolvedValue(null),
    };
    const { service, store: actualStore } = createDefinitionService({ store });

    await expect(service.getForEvent(eventId, 'another-event-game', actor())).rejects.toBeInstanceOf(NotFoundException);

    expect(actualStore.findForEvent).toHaveBeenCalledWith({ eventId, gameId: 'another-event-game' }, expect.any(Object));
  });
});
