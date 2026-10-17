import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import type { AuditWriter } from '@prism/kernel/access-control';
import {
  OpsUserRole,
  WorkflowCommandService,
  type CommandReceiptRecord,
  type CommandReceiptStore,
} from '@prism/kernel/event-core';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { PrismVerifiedEventActor } from '@prism/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventGamesHostCommandService } from '../application/event-games-host-command.service';
import type { GameAuditPort } from '../contracts/game-audit.port';
import type { GameEventAccessPort } from '../contracts/game-event-access.port';
import { EventGamesEventAccessAdapter } from '../infrastructure/event-games-event-access.adapter';
import { GameAuditAdapter } from '../infrastructure/game-audit.adapter';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-16T12:00:00.000Z'));
});

afterEach(() => vi.useRealTimers());

type HostCommandRequest = {
  eventId: string;
  actor: PrismVerifiedEventActor;
  resourceType: 'session' | 'lobby';
  resourceId: string;
  action: 'start_session' | 'provision_lobby' | 'update_lobby_branding';
  command: Record<string, unknown>;
  requestReceiptId: string;
};

type PersistedHostCommand = {
  eventId: string;
  resourceType: 'session' | 'lobby';
  resourceId: string;
  action: 'start_session' | 'provision_lobby' | 'update_lobby_branding';
  outcome: 'started' | 'created' | 'updated';
  resultId: string;
  requestReceiptId: string;
  transition: {
    beforeStatus: 'scheduled' | 'active' | 'published' | 'prism' | 'ocean' | 'sunset' | 'forest' | null;
    afterStatus: 'scheduled' | 'active' | 'published' | 'prism' | 'ocean' | 'sunset' | 'forest' | null;
    beforeVersion: number | null;
    afterVersion: number | null;
  };
};

type HostCommandApi = {
  executeHostCommand(input: HostCommandRequest): Promise<PersistedHostCommand>;
};

const eventOne = 'event-1';
const eventTwo = 'event-2';
const sessionId = 'session-1';

function actor(overrides: Partial<PrismVerifiedEventActor> = {}): PrismVerifiedEventActor {
  return {
    id: 'actor-1',
    actorId: 'actor-1',
    role: 'coordinator',
    actorRole: 'coordinator',
    email: 'private@example.test',
    actorEmail: 'private@example.test',
    name: 'Private Name',
    actorName: 'Private Name',
    expiresAt: '2030-01-01T00:00:00.000Z',
    eventId: eventOne,
    ...overrides,
  };
}

function command(overrides: Partial<HostCommandRequest> = {}): HostCommandRequest {
  return {
    eventId: eventOne,
    actor: actor(),
    resourceType: 'session',
    resourceId: sessionId,
    action: 'start_session',
    command: { answerKey: 'must-not-be-audited' },
    requestReceiptId: 'receipt-1',
    ...overrides,
  };
}

function createTransactionRunner() {
  const committedMutations: PersistedHostCommand[] = [];
  let rollbacks = 0;
  const fakePrisma = {
    async $transaction<T>(work: (tx: { mutations: PersistedHostCommand[] }) => Promise<T>) {
      const tx = { mutations: [] as PersistedHostCommand[] };
      try {
        const result = await work(tx);
        committedMutations.push(...tx.mutations);
        return result;
      } catch (error) {
        rollbacks += 1;
        throw error;
      }
    },
  };

  return {
    runner: new PrismTransactionRunner(fakePrisma as never),
    committedMutations,
    get rollbacks() {
      return rollbacks;
    },
  };
}

function createScopedPersistence(resources: Map<string, string>) {
  const executeHostCommand = vi.fn(
    async (
      input: HostCommandRequest,
      transaction: PrismTransactionContext,
    ): Promise<PersistedHostCommand> => {
      const resultId = resources.get(`${input.eventId}:${input.resourceId}`);
      if (!resultId) throw new NotFoundException('Game resource not found');

      const isLobbyProvision = input.action === 'provision_lobby';
      const result: PersistedHostCommand = {
        eventId: input.eventId,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
        outcome: isLobbyProvision ? 'created' : 'started',
        resultId,
        requestReceiptId: input.requestReceiptId,
        transition: isLobbyProvision
          ? { beforeStatus: null, afterStatus: 'published', beforeVersion: null, afterVersion: 1 }
          : { beforeStatus: 'scheduled', afterStatus: 'active', beforeVersion: 2, afterVersion: 3 },
      };
      (transaction.prisma as unknown as { mutations: PersistedHostCommand[] }).mutations.push(result);
      return result;
    },
  );

  return { executeHostCommand };
}

function createService(dependencies: {
  eventAccess: Pick<GameEventAccessPort, 'assertHostAccess' | 'isEventOpen'>;
  persistence: ReturnType<typeof createScopedPersistence>;
  audit: GameAuditPort;
  transactions: PrismTransactionRunner;
}): HostCommandApi {
  const Service = EventGamesHostCommandService as unknown as new (...args: unknown[]) => HostCommandApi;
  const receiptRecords = new Map<string, CommandReceiptRecord>();
  const receiptKey = (key: Pick<CommandReceiptRecord, 'commandName' | 'idempotencyKey' | 'actorId' | 'eventScope'>) =>
    JSON.stringify([key.commandName, key.idempotencyKey, key.actorId, key.eventScope]);
  const receiptStore: CommandReceiptStore = {
    find: vi.fn(async (key) => receiptRecords.get(receiptKey(key)) ?? null),
    create: vi.fn(async (input) => {
      const id = `event-game-receipt-${receiptRecords.size + 1}`;
      receiptRecords.set(receiptKey(input), {
        ...input,
        id,
        eventId: input.eventId ?? null,
        payloadHash: input.payloadHash ?? null,
        result: null,
        completedAt: new Date(),
      });
      return { id };
    }),
    complete: vi.fn(async (id, result) => {
      const receipt = [...receiptRecords.values()].find((entry) => entry.id === id);
      if (receipt) {
        receipt.result = result;
        receipt.completedAt = new Date();
      }
    }),
  };
  const workflowCommands = new WorkflowCommandService(dependencies.transactions, receiptStore);
  return new Service(
    dependencies.eventAccess,
    dependencies.persistence,
    dependencies.audit,
    workflowCommands,
  );
}

describe('EventGamesHostCommandService', () => {
  it('audits the persisted result in the same transaction as an authorized host mutation', async () => {
    const transaction = createTransactionRunner();
    const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({
      eventAccess: access,
      persistence,
      audit,
      transactions: transaction.runner,
    });

    const result = await service.executeHostCommand(command({
      command: {
        answerKey: 'must-not-be-audited',
        beforeStatus: 'forged-caller-state',
        afterStatus: 'forged-caller-state',
        beforeVersion: 900,
      },
    }));

    expect(result).toEqual({
      eventId: eventOne,
      resourceType: 'session',
      resourceId: sessionId,
      action: 'start_session',
      outcome: 'started',
      resultId: 'persisted-session-1',
      requestReceiptId: 'receipt-1',
      transition: { beforeStatus: 'scheduled', afterStatus: 'active', beforeVersion: 2, afterVersion: 3 },
    });
    expect(access.assertHostAccess).toHaveBeenCalledWith(eventOne, expect.objectContaining({ actorId: 'actor-1' }));
    expect(persistence.executeHostCommand).toHaveBeenCalledTimes(1);
    expect(transaction.committedMutations).toEqual([result]);
    expect(audit.recordHostWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: eventOne,
        actorId: 'actor-1',
        actorRole: 'coordinator',
        resourceType: 'session',
        resourceId: sessionId,
        action: 'start_session',
        outcome: 'started',
        resultId: 'persisted-session-1',
        requestReceiptId: 'receipt-1',
        transition: { beforeStatus: 'scheduled', afterStatus: 'active', beforeVersion: 2, afterVersion: 3 },
      }),
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
    const persistenceContext = persistence.executeHostCommand.mock.calls[0]?.[1];
    const auditContext = audit.recordHostWrite.mock.calls[0]?.[1];
    expect(auditContext).toBe(persistenceContext);
  });

  it('does not persist or audit a host command after event closure', async () => {
    const transaction = createTransactionRunner();
    const access = {
      assertHostAccess: vi.fn().mockResolvedValue(undefined),
      isEventOpen: vi.fn().mockResolvedValue(false),
    };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({ eventAccess: access, persistence, audit, transactions: transaction.runner });

    await expect(service.executeHostCommand(command())).rejects.toThrow('Event games are closed');
    expect(persistence.executeHostCommand).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
    expect(transaction.committedMutations).toEqual([]);
  });

  it('persists and audits lobby provisioning through the same authorized host command transaction', async () => {
    const transaction = createTransactionRunner();
    const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
    const lobbySlug = 'A'.repeat(43);
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${eventOne}`, lobbySlug]]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({ eventAccess: access, persistence, audit, transactions: transaction.runner });

    const result = await service.executeHostCommand({
      eventId: eventOne,
      actor: actor(),
      resourceType: 'lobby',
      resourceId: eventOne,
      action: 'provision_lobby',
      command: { lobbySlug },
      requestReceiptId: `provision-game-lobby:${eventOne}:${lobbySlug}`,
    });

    expect(result).toMatchObject({
      eventId: eventOne,
      resourceType: 'lobby',
      resourceId: eventOne,
      action: 'provision_lobby',
      outcome: 'created',
      resultId: lobbySlug,
      transition: { beforeStatus: null, afterStatus: 'published', beforeVersion: null, afterVersion: 1 },
    });
    expect(persistence.executeHostCommand).toHaveBeenCalledTimes(1);
    expect(transaction.committedMutations).toEqual([result]);
    expect(audit.recordHostWrite).toHaveBeenCalledWith(expect.objectContaining({
      eventId: eventOne,
      resourceType: 'lobby',
      resourceId: eventOne,
      action: 'provision_lobby',
      resultId: lobbySlug,
    }), expect.any(Object));
    expect(audit.recordHostWrite.mock.calls[0]?.[1]).toBe(persistence.executeHostCommand.mock.calls[0]?.[1]);
  });

  it('replays the original receipt for the same authorized command without a second mutation or audit', async () => {
    const transaction = createTransactionRunner();
    const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({ eventAccess: access, persistence, audit, transactions: transaction.runner });
    const request = command();

    const first = await service.executeHostCommand(request);
    const replay = await service.executeHostCommand(request);

    expect(replay).toEqual(first);
    expect(access.assertHostAccess).toHaveBeenCalledTimes(2);
    expect(persistence.executeHostCommand).toHaveBeenCalledTimes(1);
    expect(audit.recordHostWrite).toHaveBeenCalledTimes(1);
    expect(transaction.committedMutations).toEqual([first]);
  });

  it('rejects reuse of a command receipt key with different content', async () => {
    const transaction = createTransactionRunner();
    const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({ eventAccess: access, persistence, audit, transactions: transaction.runner });

    await service.executeHostCommand(command());
    await expect(service.executeHostCommand(command({ command: { reason: 'different command payload' } })))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(persistence.executeHostCommand).toHaveBeenCalledTimes(1);
    expect(audit.recordHostWrite).toHaveBeenCalledTimes(1);
    expect(transaction.committedMutations).toHaveLength(1);
  });

  it('rechecks host authorization before returning a stored command receipt', async () => {
    const transaction = createTransactionRunner();
    const access = {
      assertHostAccess: vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new ForbiddenException('Host access required')),
      isEventOpen: vi.fn().mockResolvedValue(true),
    };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({ eventAccess: access, persistence, audit, transactions: transaction.runner });
    const request = command();

    await service.executeHostCommand(request);
    await expect(service.executeHostCommand(request)).rejects.toBeInstanceOf(ForbiddenException);

    expect(access.assertHostAccess).toHaveBeenCalledTimes(2);
    expect(persistence.executeHostCommand).toHaveBeenCalledTimes(1);
    expect(audit.recordHostWrite).toHaveBeenCalledTimes(1);
  });

  it('does not mutate or audit when a valid event actor targets a resource owned by another event', async () => {
    const transaction = createTransactionRunner();
    const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
    const persistence = createScopedPersistence(new Map([[`${eventTwo}:${sessionId}`, 'event-two-session']]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({
      eventAccess: access,
      persistence,
      audit,
      transactions: transaction.runner,
    });

    await expect(service.executeHostCommand(command({ resourceId: sessionId }))).rejects.toBeInstanceOf(NotFoundException);

    expect(persistence.executeHostCommand).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: eventOne, resourceId: sessionId }),
      expect.any(Object),
    );
    expect(transaction.committedMutations).toEqual([]);
    expect(transaction.rollbacks).toBe(1);
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('rolls back a persisted mutation when writing its audit record fails', async () => {
    const transaction = createTransactionRunner();
    const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    const audit = { recordHostWrite: vi.fn().mockRejectedValue(new Error('audit unavailable')) };
    const service = createService({
      eventAccess: access,
      persistence,
      audit,
      transactions: transaction.runner,
    });

    await expect(service.executeHostCommand(command())).rejects.toThrow('audit unavailable');

    expect(persistence.executeHostCommand).toHaveBeenCalledTimes(1);
    expect(transaction.committedMutations).toEqual([]);
    expect(transaction.rollbacks).toBe(1);
  });

  it('rejects a persistence result from another event before it can be audited', async () => {
    const transaction = createTransactionRunner();
    const access = { assertHostAccess: vi.fn().mockResolvedValue(undefined), isEventOpen: vi.fn().mockResolvedValue(true) };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    persistence.executeHostCommand.mockImplementationOnce(async (input, tx) => {
      (tx.prisma as unknown as { mutations: PersistedHostCommand[] }).mutations.push({
        eventId: eventTwo,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
        outcome: 'started',
        resultId: 'cross-event-result',
        requestReceiptId: input.requestReceiptId,
        transition: { beforeStatus: 'scheduled', afterStatus: 'active', beforeVersion: 2, afterVersion: 3 },
      });
      return {
        eventId: eventTwo,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
        outcome: 'started',
        resultId: 'cross-event-result',
        requestReceiptId: input.requestReceiptId,
        transition: { beforeStatus: 'scheduled', afterStatus: 'active', beforeVersion: 2, afterVersion: 3 },
      };
    });
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({
      eventAccess: access,
      persistence,
      audit,
      transactions: transaction.runner,
    });

    await expect(service.executeHostCommand(command())).rejects.toThrow();

    expect(transaction.committedMutations).toEqual([]);
    expect(transaction.rollbacks).toBe(1);
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
  });

  it('does not reach persistence or audit when the verified actor lacks host access', async () => {
    const transaction = createTransactionRunner();
    const access = {
      assertHostAccess: vi.fn().mockRejectedValue(new ForbiddenException('Host access required')),
      isEventOpen: vi.fn().mockResolvedValue(true),
    };
    const persistence = createScopedPersistence(new Map([[`${eventOne}:${sessionId}`, 'persisted-session-1']]));
    const audit = { recordHostWrite: vi.fn().mockResolvedValue(undefined) };
    const service = createService({
      eventAccess: access,
      persistence,
      audit,
      transactions: transaction.runner,
    });

    await expect(service.executeHostCommand(command())).rejects.toBeInstanceOf(ForbiddenException);

    expect(persistence.executeHostCommand).not.toHaveBeenCalled();
    expect(audit.recordHostWrite).not.toHaveBeenCalled();
    expect(transaction.committedMutations).toEqual([]);
  });
});

describe('GameAuditAdapter', () => {
  it.each(['prism', 'ocean', 'sunset', 'forest'] as const)(
    'accepts the configured %s lobby theme as safe transition metadata',
    async (theme) => {
      const write = vi.fn().mockResolvedValue(undefined);
      const adapter = new GameAuditAdapter({ write } as unknown as AuditWriter);
      const transaction = { prisma: {}, correlationId: 'correlation-brand', actorId: 'actor-1' } as PrismTransactionContext;

      await adapter.recordHostWrite({
        eventId: eventOne,
        actorId: 'actor-1',
        actorRole: 'pmcm-admin',
        action: 'update_lobby_branding',
        resourceType: 'lobby',
        resourceId: eventOne,
        outcome: 'updated',
        resultId: eventOne,
        requestReceiptId: 'brand-receipt',
        transition: { beforeStatus: 'prism', afterStatus: theme, beforeVersion: 1, afterVersion: 2 },
        timestamp: new Date('2026-10-17T00:00:00.000Z'),
      }, transaction);

      expect(write).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({ beforeStatus: 'prism', afterStatus: theme }),
      }), transaction);
    },
  );

  it('writes only allowlisted identifiers and outcome, excluding command secrets and actor profile data', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const auditWriter = { write } as unknown as AuditWriter;
    const adapter = new GameAuditAdapter(auditWriter);
    const transaction = {
      prisma: {} as never,
      correlationId: 'correlation-1',
      actorId: 'actor-1',
    } as PrismTransactionContext;
    const secretBearingInput = {
      eventId: eventOne,
      actorId: 'actor-1',
      actorRole: 'coordinator',
      action: 'start_session',
      resourceType: 'session',
      resourceId: sessionId,
      outcome: 'started',
      resultId: sessionId,
      requestReceiptId: 'receipt-1',
      transition: { beforeStatus: 'scheduled', afterStatus: 'active', beforeVersion: 2, afterVersion: 3 },
      timestamp: new Date('2026-10-15T00:00:00.000Z'),
      priorState: { answerKey: 'hidden-answer-key', photoUrl: 'private-photo' },
      newState: { guestName: 'Hidden Guest', correctAnswer: 'secret-answer' },
      command: {
        answerKey: 'hidden-answer-key',
        guestName: 'Hidden Guest',
        photoUrl: 'private-photo',
        pin: 'raw-pin-1234',
        participantToken: 'participant-token-secret',
      },
      actor: { actorName: 'Private Name', actorEmail: 'private@example.test' },
      stateSnapshot: { correctAnswer: 'secret-answer' },
    };
    const recordHostWrite = adapter.recordHostWrite.bind(adapter) as unknown as (
      input: Record<string, unknown>,
      context: PrismTransactionContext,
    ) => Promise<void>;

    await recordHostWrite(secretBearingInput, transaction);

    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: eventOne,
        actor: 'actor-1',
        actorRole: 'coordinator',
        action: 'start_session',
        affectedType: 'event_game',
        affectedId: sessionId,
        affectedLabel: 'start_session',
        metadata: {
          resourceType: 'session',
          resourceId: sessionId,
          outcome: 'started',
          resultId: sessionId,
          requestReceiptId: 'receipt-1',
          beforeStatus: 'scheduled',
          afterStatus: 'active',
          beforeVersion: 2,
          afterVersion: 3,
        },
      }),
      transaction,
    );
    const serializedAudit = JSON.stringify(write.mock.calls[0]);
    expect(serializedAudit).not.toContain('hidden-answer-key');
    expect(serializedAudit).not.toContain('Hidden Guest');
    expect(serializedAudit).not.toContain('private-photo');
    expect(serializedAudit).not.toContain('private@example.test');
    expect(serializedAudit).not.toContain('Private Name');
    expect(serializedAudit).not.toContain('secret-answer');
    expect(serializedAudit).not.toContain('raw-pin-1234');
    expect(serializedAudit).not.toContain('participant-token-secret');
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty('actorEmail');
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty('priorState');
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty('newState');
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty('command');
    expect(write.mock.calls[0]?.[0]).not.toHaveProperty('stateSnapshot');
  });
});

describe('EventGamesEventAccessAdapter', () => {
  function createAdapter(assignments: Array<{ eventId: string; coordinatorId: string; userId: string }>) {
    const eventLookups: string[] = [];
    const assignmentLookups: string[] = [];
    const prisma = {
      opsEvent: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          eventLookups.push(where.id);
          return {
            id: where.id, clientName: 'Client', clientPortalStatus: 'unlocked',
            inquiry: { email: 'client@example.test' }, archived: true,
            archivedAt: new Date('2026-10-01T00:00:00Z'), actualEndedAt: null, status: 'archived',
          };
        }),
      },
      opsSupplierQuoteRequest: { findMany: vi.fn().mockResolvedValue([]) },
      opsCoordinatorAssignment: {
        findMany: vi.fn(async ({ where }: { where: { eventId: string } }) => {
          assignmentLookups.push(where.eventId);
          return assignments
            .filter((assignment) => assignment.eventId === where.eventId)
            .map(({ coordinatorId, userId }) => ({
              coordinatorId,
              coordinator: { active: true, userId, email: 'coord@example.test' },
            }));
        }),
      },
    };
    const auditWriter = { write: vi.fn().mockResolvedValue(undefined) } as unknown as AuditWriter;
    return {
      adapter: new EventGamesEventAccessAdapter(prisma as never, new EventAccessPolicyService(auditWriter)),
      eventLookups,
      assignmentLookups,
    };
  }

  it('uses persisted assignment and exact event scope, denying unassigned coordinators, guests, and suppliers', async () => {
    const { adapter, eventLookups, assignmentLookups } = createAdapter([
      { eventId: eventOne, coordinatorId: 'coord-1', userId: 'actor-1' },
    ]);
    const assignedCoordinator = actor({ coordinatorId: 'coord-1' });

    await expect(adapter.assertHostAccess(eventOne, assignedCoordinator)).resolves.toBeUndefined();
    await expect(adapter.assertHostAccess(eventTwo, assignedCoordinator)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(adapter.assertHostAccess(eventOne, actor({ coordinatorId: 'coord-other', actorId: 'other' })))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(adapter.assertHostAccess(eventOne, actor({ role: OpsUserRole.Guest, actorRole: OpsUserRole.Guest })))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(adapter.assertHostAccess(eventOne, actor({ role: OpsUserRole.Supplier, actorRole: OpsUserRole.Supplier })))
      .rejects.toBeInstanceOf(ForbiddenException);

    expect(eventLookups).toEqual([eventOne, eventTwo, eventOne]);
    expect(assignmentLookups).toEqual([eventOne, eventTwo, eventOne]);
  });

  it('allows PMCM Admin and System actors through the real adapter', async () => {
    const { adapter, eventLookups, assignmentLookups } = createAdapter([]);

    await expect(
      adapter.assertHostAccess(eventOne, actor({ role: OpsUserRole.PmcmAdmin, actorRole: OpsUserRole.PmcmAdmin })),
    ).resolves.toBeUndefined();
    await expect(
      adapter.assertHostAccess(eventTwo, actor({ role: OpsUserRole.System, actorRole: OpsUserRole.System })),
    ).resolves.toBeUndefined();

    expect(eventLookups).toEqual([eventOne, eventTwo]);
    expect(assignmentLookups).toEqual([eventOne, eventTwo]);
  });

  it('restricts retained response review to PMCM Admin and returns only retention facts', async () => {
    const { adapter } = createAdapter([]);
    const admin = actor({ role: OpsUserRole.PmcmAdmin, actorRole: OpsUserRole.PmcmAdmin });
    const prisma = {
      opsEvent: {
        findUnique: vi.fn().mockResolvedValue({
          id: eventOne, archived: true, archivedAt: new Date('2026-10-01T00:00:00Z'),
          actualEndedAt: null, status: 'archived',
        }),
      },
    };

    await expect(adapter.assertAdminAccess(eventOne, admin)).resolves.toBeUndefined();
    await expect(adapter.assertAdminAccess(eventOne, actor({ role: OpsUserRole.System, actorRole: OpsUserRole.System })))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(adapter.assertAdminAccess(eventOne, actor({ role: OpsUserRole.Coordinator, actorRole: OpsUserRole.Coordinator })))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(adapter.getResponseRetentionScope(eventOne, { prisma } as never)).resolves.toEqual({
      eventId: eventOne, archivedAt: new Date('2026-10-01T00:00:00Z'), closed: true,
    });
  });
});
