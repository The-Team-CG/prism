import { describe, expect, it, vi } from 'vitest';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { OperationsEventReferenceService } from './operations-event-reference.service';

describe('OperationsEventReferenceService', () => {
  const event = {
    id: 'evt_1',
    eventName: 'Launch',
    clientName: 'Client',
    eventDate: new Date('2026-08-01T00:00:00.000Z'),
    status: 'planning',
    archived: false,
    actualEndedAt: null,
    walkInPolicy: 'closed',
    walkInThreshold: 200,
  };

  it('reads event privacy and the newest persisted briefing guest count with a stable tie-break', async () => {
    const eventReference = {
      id: event.id,
      eventName: event.eventName,
      walkInPolicy: event.walkInPolicy,
      walkInThreshold: event.walkInThreshold,
      guestPrivacyClassification: 'unclassified',
    };
    const findUnique = vi.fn(async () => eventReference);
    const findFirst = vi.fn(async () => ({ guestCount: 199 }));
    const service = new OperationsEventReferenceService({
      opsEvent: { findUnique },
      opsBriefing: { findFirst },
    } as never);

    await expect(service.findGuestCheckInEventReference(event.id)).resolves.toEqual({
      id: event.id,
      eventName: event.eventName,
      walkInPolicy: event.walkInPolicy,
      walkInThreshold: event.walkInThreshold,
      guestPrivacyClassification: 'unclassified',
      briefingGuestCount: 199,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { eventId: event.id },
      orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      select: { guestCount: true },
    });
  });

  it('updates Lifecycle-owned guest privacy and skips writes when classification is unchanged', async () => {
    const eventReference = { ...event, guestPrivacyClassification: 'unclassified' };
    const findUnique = vi.fn(async () => eventReference);
    const update = vi.fn(async ({ data }: { data: { guestPrivacyClassification: string } }) => ({
      ...eventReference,
      ...data,
    }));
    const findFirst = vi.fn(async () => null);
    const queryRaw = vi.fn(async () => [{ id: event.id }]);
    const service = new OperationsEventReferenceService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsEvent: { findUnique, update }, opsBriefing: { findFirst } },
    } as unknown as PrismTransactionContext;

    await expect(service.updateGuestPrivacyClassification(
      event.id,
      { classification: 'private' },
      transaction,
    )).resolves.toEqual({
      before: { eventId: event.id, eventName: event.eventName, classification: 'unclassified' },
      after: { eventId: event.id, eventName: event.eventName, classification: 'private' },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: { guestPrivacyClassification: 'private' },
      select: { id: true, eventName: true, guestPrivacyClassification: true },
    });

    await expect(service.updateGuestPrivacyClassification(
      event.id,
      { classification: 'unclassified' },
      transaction,
    )).resolves.toEqual({
      before: { eventId: event.id, eventName: event.eventName, classification: 'unclassified' },
      after: { eventId: event.id, eventName: event.eventName, classification: 'unclassified' },
    });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('locks and returns only Lifecycle fields needed by Operations commands', async () => {
    const findUnique = vi.fn(async () => event);
    const queryRaw = vi.fn(async () => [{ id: event.id }]);
    const service = new OperationsEventReferenceService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsEvent: { findUnique } },
    } as unknown as PrismTransactionContext;

    await expect(service.findOperationsEvent(event.id, transaction)).resolves.toEqual(event);
    expect(queryRaw).toHaveBeenCalledWith(
      'SELECT "id" FROM "event_lifecycle"."events" WHERE "id" = $1 FOR UPDATE',
      event.id,
    );
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: event.id },
      select: {
        id: true,
        eventName: true,
        clientName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
      },
    });
  });

  it('returns missing when Lifecycle cannot lock the requested event', async () => {
    const findUnique = vi.fn();
    const queryRaw = vi.fn(async () => []);
    const service = new OperationsEventReferenceService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsEvent: { findUnique } },
    } as unknown as PrismTransactionContext;

    await expect(service.findOperationsEvent('missing', transaction)).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('batch-reads only requested Lifecycle event fields and avoids an empty query', async () => {
    const findMany = vi.fn(async () => [event]);
    const service = new OperationsEventReferenceService({ opsEvent: { findMany } } as never);

    await expect(service.findOperationsEvents([event.id])).resolves.toEqual([event]);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: [event.id] } },
      select: {
        id: true,
        eventName: true,
        clientName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
      },
    });
    await expect(service.findOperationsEvents([])).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('returns only the event fields needed for client read authorization', async () => {
    const findUnique = vi.fn(async () => ({ id: event.id, clientName: 'Client', clientPortalStatus: 'unlocked', clientEmail: null, inquiry: { email: 'client@example.test' } }));
    const service = new OperationsEventReferenceService({ opsEvent: { findUnique } } as never);

    await expect(service.findEventReadAccess(event.id)).resolves.toMatchObject({
      id: event.id,
      clientName: 'Client',
      clientPortalStatus: 'unlocked',
      inquiry: { email: 'client@example.test' },
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: event.id },
      select: { id: true, clientName: true, clientPortalStatus: true, clientEmail: true, inquiry: { select: { email: true } } },
    });
  });

  it('updates guest policy through Lifecycle and returns before and after snapshots', async () => {
    const findUnique = vi.fn(async () => event);
    const update = vi.fn(async ({ data }: { data: { walkInPolicy: string; walkInThreshold?: number } }) => ({
      ...event,
      ...data,
    }));
    const queryRaw = vi.fn(async () => [{ id: event.id }]);
    const service = new OperationsEventReferenceService({} as never);
    const transaction = {
      prisma: { $queryRawUnsafe: queryRaw, opsEvent: { findUnique, update } },
    } as unknown as PrismTransactionContext;

    await expect(service.updateWalkInPolicy(event.id, { policy: 'threshold', threshold: 300 }, transaction)).resolves.toEqual({
      before: { eventId: event.id, eventName: event.eventName, policy: 'closed', threshold: 200 },
      after: { eventId: event.id, eventName: event.eventName, policy: 'threshold', threshold: 300 },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: event.id },
      data: { walkInPolicy: 'threshold', walkInThreshold: 300 },
      select: {
        id: true,
        eventName: true,
        clientName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
      },
    });
  });
});
