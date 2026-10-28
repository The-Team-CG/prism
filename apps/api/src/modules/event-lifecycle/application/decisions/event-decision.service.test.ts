import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventDecisionService } from './event-decision.service';
import { EventDecisionSupplierOwnerService } from '@prism/contexts/commercial';

const actor = { id: 'pmcm-1', role: 'pmcm-admin', name: 'PMCM Admin', email: 'pmcm@example.test', explicit: true } as const;
const event = {
  id: 'evt-1',
  status: 'planning',
  freezeStatus: 'open',
  eventDate: new Date('2026-11-10T00:00:00.000Z'),
  eventName: 'Launch',
  inquiry: { email: 'client@example.test' },
  clientName: 'Client',
  clientPortalStatus: 'unlocked',
};
const NEXT_DATE = new Date('2026-12-10T00:00:00.000Z');
const cancel = {
  decision: 'cancelled',
  reason: 'Client confirmed',
  cancellationFeeAmount: 0,
  depositTreatment: 'pending_review',
  supplierImpact: 'pending_review',
  impactReviewAcknowledged: true,
} as const;
const postpone = (supplierImpact: 'release_obligations' | 'preserve_obligations' | 'pending_review') => ({
  decision: 'postponed',
  reason: 'Venue unavailable',
  newEventDate: '2026-12-10',
  cancellationFeeAmount: 0,
  depositTreatment: 'credit',
  supplierImpact,
  impactReviewAcknowledged: true,
}) as const;

function setup(options: { eventOverrides?: Partial<typeof event>; staffingImpact?: unknown; approvedExceptionIds?: string[] } = {}) {
  // Freeze exception store. Approvals are single-use: the conditional update matches only while the row is unconsumed.
  const exceptions = new Map((options.approvedExceptionIds ?? []).map((id) => [id, {
    id, eventId: 'evt-1', status: 'approved', consumedAt: null as Date | null, consumedByDecisionId: null as string | null,
  }]));
  const exceptionStore = {
    updateMany: vi.fn(async ({ where, data }: { where: { id: string; eventId: string; status: string; consumedAt: null }; data: { consumedAt: Date; consumedByDecisionId?: string } }) => {
      const row = exceptions.get(where.id);
      if (!row || row.eventId !== where.eventId || row.status !== where.status || row.consumedAt !== null) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
  };
  const tx = {
    opsEvent: {
      findUnique: vi.fn().mockResolvedValue({ ...event, ...options.eventOverrides }),
      update: vi.fn().mockResolvedValue({ ...event, status: 'postponed' }),
    },
    opsEventFreezeException: exceptionStore,
    opsEventDecision: {
      create: vi.fn().mockResolvedValue({ id: 'decision-1', eventId: 'evt-1' }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    opsSupplierQuoteRequest: {
      findMany: vi.fn().mockResolvedValue([{ id: 'supplier-1', supplierName: 'Supplier', assignmentStatus: 'selected' }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  // Transactions run one at a time, like the event row lock Serializable takes in Postgres: a second decision
  // starts only after the first commits or rolls back. A failed transaction restores the exception store.
  let lock: Promise<unknown> = Promise.resolve();
  const transaction = vi.fn((callback: (value: typeof tx) => Promise<unknown>) => {
    const run = lock.then(async () => {
      const snapshot = new Map([...exceptions].map(([id, row]) => [id, { ...row }]));
      try {
        return await callback(tx);
      } catch (error) {
        exceptions.clear();
        snapshot.forEach((row, id) => exceptions.set(id, row));
        throw error;
      }
    });
    lock = run.catch(() => undefined);
    return run;
  });
  const prisma = {
    $transaction: transaction,
    opsEvent: tx.opsEvent,
    opsEventDecision: tx.opsEventDecision,
  };
  const access = { requireActorRole: vi.fn(), requireCanReadEvent: vi.fn() };
  const audit = vi.fn().mockResolvedValue(undefined);
  const notification = vi.fn().mockResolvedValue(undefined);
  const assignmentImpact = options.staffingImpact ?? {
    releasedAssignmentIds: [],
    priorAssignments: [{ id: 'assignment-1', status: 'acknowledged', coordinatorId: 'coord-1', coordinatorName: 'Coordinator One' }],
  };
  const staffingCommands = {
    applyEventDecisionAssignments: vi.fn().mockResolvedValue(assignmentImpact),
  };
  const service = new EventDecisionService(
    prisma as never,
    access as never,
    { write: audit } as never,
    { write: notification } as never,
    staffingCommands as never,
    new EventDecisionSupplierOwnerService(),
    { createConfirmedCancellationFeeSource: vi.fn(async () => ({ id: 'bsrc_fee', eventId: 'evt-1', sourceLabel: 'Cancellation fee', totalAmount: 25000, status: 'approved' })) },
  );
  return { service, tx, prisma, access, audit, notification, staffingCommands, assignmentImpact };
}

describe('EventDecisionService', () => {
  it('delegates staffing impact in the decision transaction and records the returned impact', async () => {
    const { service, tx, notification, audit, staffingCommands, assignmentImpact } = setup();
    const input = postpone('preserve_obligations');

    const result = await service.decide('evt-1', input, actor);

    expect(result).toEqual({ id: 'decision-1', eventId: 'evt-1' });
    expect(tx.opsEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt-1' },
      data: expect.objectContaining({ status: 'postponed', eventDate: NEXT_DATE }),
    }));
    expect(staffingCommands.applyEventDecisionAssignments).toHaveBeenCalledWith(
      'evt-1',
      input,
      event.eventDate.toISOString(),
      NEXT_DATE.toISOString(),
      actor,
      expect.objectContaining({ prisma: tx, actorId: actor.id }),
    );
    expect(tx.opsEventDecision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignmentImpact }),
    }));
    expect(tx.opsSupplierQuoteRequest.updateMany).not.toHaveBeenCalled();
    expect(notification).toHaveBeenCalled();
    expect(audit).toHaveBeenCalled();
  });

  it('passes cancellation to Operations and applies the selected supplier release in Lifecycle', async () => {
    const impact = { releasedAssignmentIds: ['assignment-1'], priorAssignments: [] };
    const { service, tx, staffingCommands } = setup({ staffingImpact: impact });

    await service.decide('evt-1', cancel, actor);

    expect(staffingCommands.applyEventDecisionAssignments).toHaveBeenCalledWith(
      'evt-1', cancel, event.eventDate.toISOString(), event.eventDate.toISOString(), actor,
      expect.objectContaining({ prisma: tx }),
    );
    expect(tx.opsEventDecision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ assignmentImpact: impact }),
    }));
    expect(tx.opsSupplierQuoteRequest.updateMany).toHaveBeenCalled();
  });

  it('passes unchanged dates for a decision that does not reschedule the event', async () => {
    const { service, staffingCommands } = setup();
    const input = {
      decision: 'date_to_be_confirmed',
      reason: 'Client is checking venues',
      cancellationFeeAmount: 0,
      depositTreatment: 'pending_review',
      supplierImpact: 'preserve_obligations',
    } as const;

    await service.decide('evt-1', input, actor);

    expect(staffingCommands.applyEventDecisionAssignments).toHaveBeenCalledWith(
      'evt-1', input, event.eventDate.toISOString(), event.eventDate.toISOString(), actor, expect.anything(),
    );
  });

  it('does not record or notify a decision when Operations cannot apply its assignment transition', async () => {
    const { service, tx, notification, audit, staffingCommands } = setup();
    staffingCommands.applyEventDecisionAssignments.mockRejectedValue(new Error('assignment owner unavailable'));

    await expect(service.decide('evt-1', cancel, actor)).rejects.toThrow('assignment owner unavailable');

    expect(tx.opsEventDecision.create).not.toHaveBeenCalled();
    expect(tx.opsEvent.update).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it('fails closed when the event is already cancelled without calling the staffing owner', async () => {
    const { service, tx, staffingCommands } = setup({ eventOverrides: { status: 'cancelled' } });
    await expect(service.decide('evt-1', cancel, actor)).rejects.toBeInstanceOf(BadRequestException);
    expect(staffingCommands.applyEventDecisionAssignments).not.toHaveBeenCalled();
    expect(tx.opsEventDecision.create).not.toHaveBeenCalled();
  });

  it('requires PMCM or system actor for writes', async () => {
    const { service, access, staffingCommands } = setup();
    access.requireActorRole.mockRejectedValue(new ForbiddenException());
    await expect(service.decide('evt-1', cancel, { ...actor, role: 'client' } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(staffingCommands.applyEventDecisionAssignments).not.toHaveBeenCalled();
  });

  it('limits full event decision history to PMCM and system actors', async () => {
    const { service, access, prisma } = setup();

    await service.list('evt-1', actor);

    expect(access.requireActorRole).toHaveBeenCalledWith(actor, ['pmcm-admin', 'system'], 'event decision history', 'evt-1');
    expect(prisma.opsEventDecision.findMany).toHaveBeenCalledWith({ where: { eventId: 'evt-1' }, orderBy: { decidedAt: 'asc' } });
  });

  it.each(['client', 'coordinator'] as const)('does not return decision history to a %s', async (role) => {
    const { service, access, prisma } = setup();
    access.requireActorRole.mockRejectedValue(new ForbiddenException());

    await expect(service.list('evt-1', { ...actor, role } as never)).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.opsEventDecision.findMany).not.toHaveBeenCalled();
  });

  it('replays an idempotent decision without asking Operations to mutate commitments twice', async () => {
    const { service, tx, staffingCommands } = setup();
    tx.opsEventDecision.findUnique.mockResolvedValue({
      id: 'decision-existing',
      eventId: 'evt-1',
      decision: cancel.decision,
      reason: cancel.reason,
      supplierImpact: cancel.supplierImpact,
      financialImpact: { cancellationFeeAmount: cancel.cancellationFeeAmount, depositTreatment: cancel.depositTreatment, newEventDate: null },
    } as never);
    const result = await service.decide('evt-1', { ...cancel, idempotencyKey: 'decision-key' }, actor);

    expect(result).toMatchObject({ id: 'decision-existing' });
    expect(tx.opsEvent.update).not.toHaveBeenCalled();
    expect(staffingCommands.applyEventDecisionAssignments).not.toHaveBeenCalled();
  });

  it('returns the committed decision when a concurrent same-key transaction loses serialization', async () => {
    const { service, tx, prisma } = setup();
    const committedDecision = {
      id: 'decision-committed',
      eventId: 'evt-1',
      decision: cancel.decision,
      reason: cancel.reason,
      supplierImpact: cancel.supplierImpact,
      financialImpact: { cancellationFeeAmount: cancel.cancellationFeeAmount, depositTreatment: cancel.depositTreatment, newEventDate: null },
    };
    tx.opsEventDecision.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(committedDecision as never);
    tx.opsEventDecision.create.mockResolvedValue(committedDecision as never);
    const serializationConflict = Object.assign(new Error('serialization conflict'), { code: 'P2034' });
    prisma.$transaction
      .mockImplementationOnce(async (callback) => callback(tx))
      .mockRejectedValueOnce(serializationConflict);
    const input = { ...cancel, idempotencyKey: 'decision-key' };

    const first = await service.decide('evt-1', input, actor);
    const concurrentReplay = await service.decide('evt-1', input, actor);

    expect(first).toMatchObject({ id: 'decision-committed' });
    expect(concurrentReplay).toMatchObject({ id: 'decision-committed' });
    expect(tx.opsEventDecision.create).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a decision idempotency key with a different payload', async () => {
    const { service, tx } = setup();
    tx.opsEventDecision.findUnique.mockResolvedValue({
      id: 'decision-existing',
      eventId: 'evt-1',
      decision: cancel.decision,
      reason: cancel.reason,
      supplierImpact: cancel.supplierImpact,
      financialImpact: { cancellationFeeAmount: cancel.cancellationFeeAmount, depositTreatment: cancel.depositTreatment, newEventDate: null },
    } as never);

    await expect(service.decide('evt-1', { ...cancel, reason: 'Changed payload', idempotencyKey: 'decision-key' }, actor))
      .rejects.toThrow('Decision idempotency key was reused for different content');
    expect(tx.opsEventDecision.create).not.toHaveBeenCalled();
  });

  it('replays a legacy postponement using its persisted reschedule target', async () => {
    const { service, tx, staffingCommands } = setup();
    const input = postpone('preserve_obligations');
    tx.opsEventDecision.findUnique.mockResolvedValue({
      id: 'legacy-postponement',
      eventId: 'evt-1',
      decision: input.decision,
      reason: input.reason,
      supplierImpact: input.supplierImpact,
      financialImpact: { cancellationFeeAmount: input.cancellationFeeAmount, depositTreatment: input.depositTreatment },
      assignmentImpact: { reschedule: { toDate: `${input.newEventDate}T00:00:00.000Z` } },
    } as never);

    await expect(service.decide('evt-1', { ...input, idempotencyKey: 'legacy-key' }, actor))
      .resolves.toMatchObject({ id: 'legacy-postponement' });
    expect(staffingCommands.applyEventDecisionAssignments).not.toHaveBeenCalled();
  });

  it('replays a legacy postponement without assignment rows when event state proves its target date', async () => {
    const { service, tx, staffingCommands } = setup({ eventOverrides: { eventDate: new Date('2026-12-10T00:00:00.000Z') } });
    const input = postpone('preserve_obligations');
    tx.opsEventDecision.findUnique.mockResolvedValue({
      id: 'legacy-postponement-no-assignments',
      eventId: 'evt-1',
      decision: input.decision,
      reason: input.reason,
      supplierImpact: input.supplierImpact,
      financialImpact: { cancellationFeeAmount: input.cancellationFeeAmount, depositTreatment: input.depositTreatment },
      assignmentImpact: {},
    } as never);

    await expect(service.decide('evt-1', { ...input, idempotencyKey: 'legacy-key-no-assignments' }, actor))
      .resolves.toMatchObject({ id: 'legacy-postponement-no-assignments' });
    expect(staffingCommands.applyEventDecisionAssignments).not.toHaveBeenCalled();
  });
});

describe('EventDecisionService change-freeze enforcement', () => {
  const frozen = { freezeStatus: 'frozen' } as const;

  it('rejects a cancellation or postponement on a frozen event without a freeze exception, before any side effect', async () => {
    const { service, tx, staffingCommands, notification } = setup({ eventOverrides: frozen });

    await expect(service.decide('evt-1', cancel, actor)).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.decide('evt-1', postpone('preserve_obligations'), actor)).rejects.toBeInstanceOf(BadRequestException);

    expect(staffingCommands.applyEventDecisionAssignments).not.toHaveBeenCalled();
    expect(tx.opsEventDecision.create).not.toHaveBeenCalled();
    expect(tx.opsEvent.update).not.toHaveBeenCalled();
    expect(notification).not.toHaveBeenCalled();
  });

  it('rejects an exception that is pending, rejected, or approved for a different event', async () => {
    const { service, tx, staffingCommands } = setup({ eventOverrides: frozen, approvedExceptionIds: ['exception-approved'] });

    await expect(service.decide('evt-1', { ...cancel, freezeExceptionId: 'exception-pending' }, actor)).rejects.toThrow('Freeze exception is not an unused approval for this event');
    expect(staffingCommands.applyEventDecisionAssignments).not.toHaveBeenCalled();
    expect(tx.opsEventDecision.create).not.toHaveBeenCalled();
  });

  it('records a frozen-event decision with the approved exception linked in its financial impact', async () => {
    const { service, tx } = setup({ eventOverrides: frozen, approvedExceptionIds: ['exception-approved'] });

    await service.decide('evt-1', { ...cancel, freezeExceptionId: 'exception-approved' }, actor);

    expect(tx.opsEventDecision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        financialImpact: expect.objectContaining({ freezeExceptionId: 'exception-approved' }),
      }),
    }));
  });

  it('does not require an exception on an open event', async () => {
    const { service, tx } = setup();

    await service.decide('evt-1', cancel, actor);

    expect(tx.opsEventFreezeException.updateMany).not.toHaveBeenCalled();
    expect(tx.opsEventDecision.create).toHaveBeenCalled();
  });

  it('does not replay an idempotent decision under a different freeze exception', async () => {
    const storedDecision = {
      id: 'decision-frozen',
      eventId: 'evt-1',
      decision: 'cancelled',
      reason: cancel.reason,
      supplierImpact: cancel.supplierImpact,
      financialImpact: { cancellationFeeAmount: 0, depositTreatment: 'pending_review', newEventDate: null, freezeExceptionId: 'exception-approved' },
      assignmentImpact: {},
    };
    const { service, prisma } = setup({ approvedExceptionIds: ['exception-approved', 'exception-other'] });
    prisma.opsEventDecision.findUnique.mockResolvedValue(storedDecision);

    await expect(service.decide('evt-1', { ...cancel, freezeExceptionId: 'exception-other', idempotencyKey: 'frozen-key' }, actor))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reuse of an approved exception by a later decision on the same frozen event', async () => {
    const { service, tx, staffingCommands } = setup({ eventOverrides: frozen, approvedExceptionIds: ['exception-approved'] });
    await service.decide('evt-1', { ...cancel, freezeExceptionId: 'exception-approved' }, actor);

    await expect(service.decide('evt-1', { ...postpone('preserve_obligations'), freezeExceptionId: 'exception-approved' }, actor))
      .rejects.toThrow('Freeze exception is not an unused approval for this event');

    expect(tx.opsEventDecision.create).toHaveBeenCalledTimes(1);
    expect(staffingCommands.applyEventDecisionAssignments).toHaveBeenCalledTimes(1);
  });

  it('lets exactly one of two concurrent decisions consume the same approval', async () => {
    const { service, tx } = setup({ eventOverrides: frozen, approvedExceptionIds: ['exception-approved'] });

    const outcomes = await Promise.allSettled([
      service.decide('evt-1', { ...cancel, freezeExceptionId: 'exception-approved' }, actor),
      service.decide('evt-1', { ...postpone('preserve_obligations'), freezeExceptionId: 'exception-approved' }, actor),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    const [rejected] = outcomes.filter((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    expect(rejected.reason).toBeInstanceOf(BadRequestException);
    expect(tx.opsEventDecision.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the approval unused when the decision fails after consuming it', async () => {
    const { service, tx, staffingCommands } = setup({ eventOverrides: frozen, approvedExceptionIds: ['exception-approved'] });
    staffingCommands.applyEventDecisionAssignments.mockRejectedValueOnce(new Error('Operations unavailable'));

    await expect(service.decide('evt-1', { ...cancel, freezeExceptionId: 'exception-approved' }, actor)).rejects.toThrow('Operations unavailable');
    await expect(service.decide('evt-1', { ...cancel, freezeExceptionId: 'exception-approved' }, actor)).resolves.toMatchObject({ id: 'decision-1' });

    expect(tx.opsEventDecision.create).toHaveBeenCalledTimes(1);
  });
});
