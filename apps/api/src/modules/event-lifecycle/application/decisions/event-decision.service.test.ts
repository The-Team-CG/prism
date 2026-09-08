import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventDecisionService } from './event-decision.service';

const actor = { id: 'pmcm-1', role: 'pmcm-admin', name: 'PMCM Admin', email: 'pmcm@example.test', explicit: true } as const;
const event = { id: 'evt-1', status: 'planning', eventDate: new Date('2026-11-10T00:00:00.000Z'), eventName: 'Launch', inquiry: { email: 'client@example.test' }, clientName: 'Client', clientPortalStatus: 'unlocked' };

function setup() {
  const tx = {
    opsEvent: { findUnique: vi.fn().mockResolvedValue(event), update: vi.fn().mockResolvedValue({ ...event, status: 'postponed' }) },
    opsEventDecision: { create: vi.fn().mockResolvedValue({ id: 'decision-1', eventId: 'evt-1' }), update: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn().mockResolvedValue(null) },
    opsCoordinatorAssignment: { findMany: vi.fn().mockResolvedValue([{ id: 'assignment-1', status: 'acknowledged', coordinatorName: 'Coordinator' }]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    opsSupplierQuoteRequest: { findMany: vi.fn().mockResolvedValue([{ id: 'supplier-1', supplierName: 'Supplier', assignmentStatus: 'selected' }]), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)), opsEvent: tx.opsEvent, opsEventDecision: tx.opsEventDecision };
  const access = { requireActorRole: vi.fn(), requireCanReadEvent: vi.fn(), };
  const audit = vi.fn().mockResolvedValue(undefined);
  const notification = vi.fn().mockResolvedValue(undefined);
  return { service: new EventDecisionService(prisma as never, access as never, { write: audit } as never, { write: notification } as never), tx, prisma, access, audit, notification };
}

describe('EventDecisionService', () => {
  it('records postponed state, releases assignments, preserves prior state and queues notification transactionally', async () => {
    const { service, tx, notification, audit } = setup();
    const result = await service.decide('evt-1', { decision: 'postponed', reason: 'Venue unavailable', newEventDate: '2026-12-10', cancellationFeeAmount: 0, depositTreatment: 'credit', supplierImpact: 'release_obligations' }, actor);
    expect(result).toEqual({ id: 'decision-1', eventId: 'evt-1' });
    expect(tx.opsEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'postponed' }) }));
    expect(tx.opsCoordinatorAssignment.updateMany).toHaveBeenCalled();
    expect(tx.opsSupplierQuoteRequest.updateMany).toHaveBeenCalled();
    expect(notification).toHaveBeenCalled();
    expect(audit).toHaveBeenCalled();
  });

  it('fails closed when the event is already cancelled', async () => {
    const { service, tx } = setup();
    tx.opsEvent.findUnique.mockResolvedValue({ ...event, status: 'cancelled' });
    await expect(service.decide('evt-1', { decision: 'cancelled', reason: 'Client confirmed', cancellationFeeAmount: 0, depositTreatment: 'pending_review', supplierImpact: 'pending_review' }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires PMCM or system actor for writes', async () => {
    const { service, access } = setup();
    access.requireActorRole.mockRejectedValue(new ForbiddenException());
    await expect(service.decide('evt-1', { decision: 'cancelled', reason: 'Client confirmed', cancellationFeeAmount: 0, depositTreatment: 'pending_review', supplierImpact: 'pending_review' }, { ...actor, role: 'client' } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('replays an idempotent decision without mutating commitments twice', async () => {
    const { service, tx } = setup();
    tx.opsEventDecision.findUnique.mockResolvedValue({ id: 'decision-existing', eventId: 'evt-1' });
    const result = await service.decide('evt-1', { decision: 'cancelled', reason: 'Client confirmed', cancellationFeeAmount: 0, depositTreatment: 'pending_review', supplierImpact: 'pending_review', idempotencyKey: 'decision-key' }, actor);
    expect(result).toMatchObject({ id: 'decision-existing' });
    expect(tx.opsEvent.update).not.toHaveBeenCalled();
  });
});
