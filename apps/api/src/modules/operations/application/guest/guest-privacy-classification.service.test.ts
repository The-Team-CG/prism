import { describe, expect, it, vi } from 'vitest';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { GuestPrivacyClassificationService } from './guest-privacy-classification.service';

function fixture() {
  const state = { eventId: 'evt_1', eventName: 'Summit', classification: 'unclassified' };
  const database = {};
  const prisma = {
    $transaction: vi.fn(async (work: (tx: typeof database) => Promise<unknown>) => work(database)),
  };
  const eventReferences = {
    findGuestCheckInEventReference: vi.fn(async () => ({
      id: state.eventId,
      eventName: state.eventName,
      walkInPolicy: 'open',
      walkInThreshold: 200,
      guestPrivacyClassification: state.classification,
      briefingGuestCount: 199,
    })),
  };
  const classificationOwner = {
    updateGuestPrivacyClassification: vi.fn(async (
      _eventId: string,
      input: { classification: string },
      context: { prisma: typeof database },
    ) => {
      expect(context.prisma).toBe(database);
      const before = { eventId: state.eventId, eventName: state.eventName, classification: state.classification };
      if (input.classification !== state.classification) state.classification = input.classification;
      const after = { eventId: state.eventId, eventName: state.eventName, classification: state.classification };
      return { before, after };
    }),
  };
  const auditWriter = {
    write: vi.fn(async (_entry: unknown, context?: { prisma?: typeof database; actorId?: string }) => {
      expect(context?.prisma).toBe(database);
    }),
  };
  const service = new GuestPrivacyClassificationService(
    eventReferences as never,
    classificationOwner as never,
    new WorkflowCommandService(new PrismTransactionRunner(prisma as never)),
    auditWriter as never,
  );
  return { service, state, prisma, eventReferences, classificationOwner, auditWriter };
}

describe('GuestPrivacyClassificationService', () => {
  it('reads legacy events as unclassified without changing Lifecycle state', async () => {
    const { service, state, auditWriter } = fixture();

    await expect(service.get('evt_1')).resolves.toEqual({
      eventId: 'evt_1',
      classification: 'unclassified',
    });
    expect(state.classification).toBe('unclassified');
    expect(auditWriter.write).not.toHaveBeenCalled();
  });

  it('updates Lifecycle-owned classification and audits actor plus before/after in the same transaction', async () => {
    const { service, state, prisma, classificationOwner, auditWriter } = fixture();

    await expect(service.update(
      'evt_1',
      { classification: 'private' },
      { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never,
    )).resolves.toEqual({ eventId: 'evt_1', classification: 'private' });

    expect(state.classification).toBe('private');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(classificationOwner.updateGuestPrivacyClassification).toHaveBeenCalledTimes(1);
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: 'pmcm-admin',
        metadata: expect.objectContaining({
          previousClassification: 'unclassified',
          classification: 'private',
        }),
      }),
      expect.objectContaining({ prisma: expect.anything(), actorId: 'pmcm_1' }),
    );
  });

  it('does not audit a no-op classification update', async () => {
    const { service, state, auditWriter } = fixture();
    state.classification = 'public';

    await expect(service.update(
      'evt_1',
      { classification: 'public' },
      { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never,
    )).resolves.toEqual({ eventId: 'evt_1', classification: 'public' });

    expect(auditWriter.write).not.toHaveBeenCalled();
  });

  it('rejects invalid persisted classifications rather than treating them as public', async () => {
    const { service, eventReferences } = fixture();
    eventReferences.findGuestCheckInEventReference.mockResolvedValue({
      id: 'evt_1',
      eventName: 'Summit',
      walkInPolicy: 'open',
      walkInThreshold: 200,
      guestPrivacyClassification: 'internal',
      briefingGuestCount: null,
    } as never);

    await expect(service.get('evt_1')).rejects.toThrow('invalid guest privacy classification');
  });
});
