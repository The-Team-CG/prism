import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES } from '@prism/kernel/event-core';
import { EventDecisionService } from './event-decision.service';

const actor = { id: 'pmcm-1', role: 'pmcm-admin', name: 'PMCM Admin', email: 'pmcm@example.test', explicit: true } as const;
const event = { id: 'evt-1', status: 'planning', eventDate: new Date('2026-11-10T00:00:00.000Z'), eventName: 'Launch', inquiry: { email: 'client@example.test' }, clientName: 'Client', clientPortalStatus: 'unlocked' };
const NEW_DATE = new Date('2026-12-10T00:00:00.000Z');

type AssignmentRow = {
  id: string;
  eventId: string;
  coordinatorId: string | null;
  coordinatorName: string;
  status: string;
  eventDate: Date;
  doubleBookingWarning: boolean;
  conflictEventId: string | null;
  conflictEventName: string | null;
  withdrawalReason?: string;
};

function assignment(overrides: Partial<AssignmentRow> & Pick<AssignmentRow, 'id' | 'coordinatorId'>): AssignmentRow {
  return {
    eventId: 'evt-1',
    coordinatorName: `Coordinator ${overrides.coordinatorId}`,
    status: 'acknowledged',
    eventDate: event.eventDate,
    doubleBookingWarning: false,
    conflictEventId: null,
    conflictEventName: null,
    ...overrides,
  };
}

/** Applies just enough of the Prisma where/data semantics for the assignment queries the service issues. */
function assignmentTable(rows: AssignmentRow[], eventNames: Record<string, string> = {}) {
  const matches = (value: unknown, condition: unknown): boolean => {
    if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
    if (condition && typeof condition === 'object') {
      const filter = condition as { in?: unknown[]; notIn?: unknown[]; not?: unknown };
      if (filter.in && !filter.in.includes(value)) return false;
      if (filter.notIn && filter.notIn.includes(value)) return false;
      if ('not' in filter && value === filter.not) return false;
      return true;
    }
    return value === condition;
  };
  const select = (where: Record<string, unknown>) =>
    rows.filter((row) => Object.entries(where).every(([key, condition]) => matches((row as Record<string, unknown>)[key], condition)));
  return {
    rows,
    findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
      select(where).map((row) => ({ ...row, event: { eventName: eventNames[row.eventId] ?? row.eventId } })),
    ),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<AssignmentRow> }) => {
      const targets = select(where);
      targets.forEach((row) => Object.assign(row, data));
      return { count: targets.length };
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<AssignmentRow> }) => {
      const target = rows.find((row) => row.id === where.id);
      if (!target) throw new Error('missing assignment');
      return Object.assign(target, data);
    }),
  };
}

function setup(options: { assignments?: AssignmentRow[]; eventNames?: Record<string, string>; unavailable?: Array<{ coordinatorId: string; startsAt: Date; endsAt: Date }> } = {}) {
  const assignments = assignmentTable(
    options.assignments ?? [assignment({ id: 'assignment-1', coordinatorId: 'coord-1' })],
    options.eventNames,
  );
  const unavailable = options.unavailable ?? [];
  const tx = {
    opsEvent: { findUnique: vi.fn().mockResolvedValue(event), update: vi.fn().mockResolvedValue({ ...event, status: 'postponed' }) },
    opsEventDecision: { create: vi.fn().mockResolvedValue({ id: 'decision-1', eventId: 'evt-1' }), update: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    opsCoordinatorAssignment: assignments,
    opsCoordinatorAvailability: {
      findMany: vi.fn(async ({ where }: { where: { coordinatorId: { in: string[] }; startsAt: { lte: Date }; endsAt: { gt: Date } } }) =>
        unavailable.filter((block) => where.coordinatorId.in.includes(block.coordinatorId) && block.startsAt <= where.startsAt.lte && block.endsAt > where.endsAt.gt),
      ),
    },
    opsSupplierQuoteRequest: { findMany: vi.fn().mockResolvedValue([{ id: 'supplier-1', supplierName: 'Supplier', assignmentStatus: 'selected' }]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $executeRaw: vi.fn().mockResolvedValue(1),
  };
  const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)), opsEvent: tx.opsEvent, opsEventDecision: tx.opsEventDecision };
  const access = { requireActorRole: vi.fn(), requireCanReadEvent: vi.fn(), };
  const audit = vi.fn().mockResolvedValue(undefined);
  const notification = vi.fn().mockResolvedValue(undefined);
  return { service: new EventDecisionService(prisma as never, access as never, { write: audit } as never, { write: notification } as never), tx, prisma, access, audit, notification, assignments };
}

const isActive = (row: AssignmentRow) => !(INACTIVE_COORDINATOR_ASSIGNMENT_STATUSES as readonly string[]).includes(row.status);

const cancel = { decision: 'cancelled', reason: 'Client confirmed', cancellationFeeAmount: 0, depositTreatment: 'pending_review', supplierImpact: 'pending_review' } as const;
const postpone = (supplierImpact: 'release_obligations' | 'preserve_obligations' | 'pending_review') =>
  ({ decision: 'postponed', reason: 'Venue unavailable', newEventDate: '2026-12-10', cancellationFeeAmount: 0, depositTreatment: 'credit', supplierImpact }) as const;

describe('EventDecisionService', () => {
  it('records postponed state, releases assignments, preserves prior state and queues notification transactionally', async () => {
    const { service, tx, notification, audit, assignments } = setup();
    const result = await service.decide('evt-1', postpone('release_obligations'), actor);
    expect(result).toEqual({ id: 'decision-1', eventId: 'evt-1' });
    expect(tx.opsEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'postponed' }) }));
    expect(assignments.rows.filter(isActive)).toEqual([]);
    expect(tx.opsSupplierQuoteRequest.updateMany).toHaveBeenCalled();
    expect(notification).toHaveBeenCalled();
    expect(audit).toHaveBeenCalled();
  });

  it('frees every coordinator on a cancelled event for booking on the same date', async () => {
    const other = assignment({ id: 'other-event', eventId: 'evt-2', coordinatorId: 'coord-1' });
    const alreadyReleased = assignment({ id: 'released-earlier', coordinatorId: 'coord-3', status: 'cancelled', withdrawalReason: 'Withdrew: family emergency' });
    const { service, assignments } = setup({
      assignments: [
        assignment({ id: 'pending', coordinatorId: 'coord-1', status: 'pending_acknowledgement' }),
        assignment({ id: 'acknowledged', coordinatorId: 'coord-2' }),
        alreadyReleased,
        other,
      ],
    });

    await service.decide('evt-1', cancel, actor);

    // The same test staffing uses to decide whether a coordinator still occupies the date.
    expect(assignments.rows.filter((row) => row.eventId === 'evt-1').filter(isActive)).toEqual([]);
    expect(assignments.rows.find((row) => row.id === 'pending')).toMatchObject({ withdrawalReason: 'Event cancelled: Client confirmed', withdrawnBy: 'pmcm-1' });
    expect(alreadyReleased.withdrawalReason).toBe('Withdrew: family emergency');
    expect(other.status).toBe('acknowledged');
  });

  it('moves coordinators that stay on a postponed event to its new date without releasing them', async () => {
    const released = assignment({ id: 'released-earlier', coordinatorId: 'coord-3', status: 'replaced' });
    const { service, assignments } = setup({
      assignments: [
        assignment({ id: 'kept-1', coordinatorId: 'coord-1', status: 'pending_acknowledgement' }),
        assignment({ id: 'kept-2', coordinatorId: 'coord-2' }),
        released,
      ],
    });

    await service.decide('evt-1', postpone('preserve_obligations'), actor);

    const kept = assignments.rows.filter((row) => row.id.startsWith('kept'));
    expect(kept.map((row) => [row.status, row.eventDate.toISOString()])).toEqual([
      ['pending_acknowledgement', NEW_DATE.toISOString()],
      ['acknowledged', NEW_DATE.toISOString()],
    ]);
    expect(released.eventDate).toEqual(event.eventDate);
  });

  it('flags a kept coordinator who is already booked elsewhere on the new date and records the clash', async () => {
    const { service, assignments, tx } = setup({
      assignments: [
        assignment({ id: 'kept-1', coordinatorId: 'coord-1' }),
        assignment({ id: 'kept-2', coordinatorId: 'coord-2' }),
        assignment({ id: 'booking-elsewhere', eventId: 'evt-2', coordinatorId: 'coord-1', eventDate: NEW_DATE }),
      ],
      eventNames: { 'evt-2': 'Charity Gala' },
    });

    await service.decide('evt-1', postpone('pending_review'), actor);

    expect(assignments.rows.find((row) => row.id === 'kept-1')).toMatchObject({ doubleBookingWarning: true, conflictEventId: 'evt-2', conflictEventName: 'Charity Gala' });
    expect(assignments.rows.find((row) => row.id === 'kept-2')).toMatchObject({ doubleBookingWarning: false, conflictEventId: null });
    expect(assignments.rows.find((row) => row.id === 'booking-elsewhere')).toMatchObject({ doubleBookingWarning: false, eventId: 'evt-2' });
    const impact = tx.opsEventDecision.create.mock.calls[0][0].data.assignmentImpact;
    expect(impact.reschedule.conflicts).toEqual([{ assignmentId: 'kept-1', coordinatorName: 'Coordinator coord-1', reason: 'double_booking', conflictEventId: 'evt-2', conflictEventName: 'Charity Gala' }]);
  });

  it('clears a stale double-booking flag once the event leaves the clashing date and reports declared unavailability', async () => {
    const { service, assignments, tx } = setup({
      assignments: [
        assignment({ id: 'kept-1', coordinatorId: 'coord-1', doubleBookingWarning: true, conflictEventId: 'evt-9', conflictEventName: 'Old clash' }),
        assignment({ id: 'kept-2', coordinatorId: 'coord-2' }),
      ],
      unavailable: [{ coordinatorId: 'coord-2', startsAt: new Date('2026-12-01T00:00:00.000Z'), endsAt: new Date('2026-12-15T00:00:00.000Z') }],
    });

    await service.decide('evt-1', postpone('preserve_obligations'), actor);

    expect(assignments.rows.find((row) => row.id === 'kept-1')).toMatchObject({ doubleBookingWarning: false, conflictEventId: null, conflictEventName: null });
    const impact = tx.opsEventDecision.create.mock.calls[0][0].data.assignmentImpact;
    expect(impact.reschedule.conflicts).toEqual([{ assignmentId: 'kept-2', coordinatorName: 'Coordinator coord-2', reason: 'unavailable' }]);
    expect(assignments.rows.find((row) => row.id === 'kept-2')?.eventDate).toEqual(NEW_DATE);
  });

  it('leaves coordinator dates alone when the event date does not change', async () => {
    const { service, assignments } = setup();

    await service.decide('evt-1', { decision: 'date_to_be_confirmed', reason: 'Client is checking venues', cancellationFeeAmount: 0, depositTreatment: 'pending_review', supplierImpact: 'preserve_obligations' }, actor);

    expect(assignments.updateMany).not.toHaveBeenCalled();
    expect(assignments.rows[0]).toMatchObject({ status: 'acknowledged', eventDate: event.eventDate });
  });

  it('fails closed when the event is already cancelled', async () => {
    const { service, tx } = setup();
    tx.opsEvent.findUnique.mockResolvedValue({ ...event, status: 'cancelled' });
    await expect(service.decide('evt-1', cancel, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires PMCM or system actor for writes', async () => {
    const { service, access } = setup();
    access.requireActorRole.mockRejectedValue(new ForbiddenException());
    await expect(service.decide('evt-1', cancel, { ...actor, role: 'client' } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('replays an idempotent decision without mutating commitments twice', async () => {
    const { service, tx, assignments } = setup();
    tx.opsEventDecision.findUnique.mockResolvedValue({ id: 'decision-existing', eventId: 'evt-1' });
    const result = await service.decide('evt-1', { ...cancel, idempotencyKey: 'decision-key' }, actor);
    expect(result).toMatchObject({ id: 'decision-existing' });
    expect(tx.opsEvent.update).not.toHaveBeenCalled();
    expect(assignments.rows.every(isActive)).toBe(true);
  });
});
