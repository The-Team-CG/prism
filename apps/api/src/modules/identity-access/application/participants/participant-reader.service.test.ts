import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ParticipantReaderService } from './participant-reader.service';

function harness(overrides: Record<string, unknown> = {}) {
  const user = { id: 'u_client', name: 'Client', email: 'client@example.test', role: OpsUserRole.Client, approvalStatus: 'approved' };
  const event = { id: 'evt_1', clientPortalStatus: 'unlocked', clientName: 'Client', inquiry: { email: user.email }, supplierQuoteRequests: [], coordinatorAssignments: [] };
  const prisma = { opsUser: { findUnique: vi.fn(async (): Promise<Record<string, unknown> | null> => ({ ...user, ...overrides })) }, opsEvent: { findUnique: vi.fn(async () => event) }, opsSupplier: { findFirst: vi.fn() }, opsCoordinator: { findUnique: vi.fn() } };
  const policy = { requireCanReadEvent: vi.fn(async () => undefined) };
  return { service: new ParticipantReaderService(prisma as never, policy as never), prisma, policy, user, event };
}

describe('ParticipantReaderService', () => {
  it('rejects unknown and unapproved accounts', async () => {
    const unknown = harness(); unknown.prisma.opsUser.findUnique.mockResolvedValueOnce(null);
    await expect(unknown.service.resolveForEvent('missing', 'evt_1')).rejects.toBeInstanceOf(NotFoundException);
    const pending = harness({ approvalStatus: 'pending' });
    await expect(pending.service.resolveForEvent('u_client', 'evt_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires client event ownership through the shared event policy', async () => {
    const h = harness(); h.policy.requireCanReadEvent.mockRejectedValueOnce(new ForbiddenException('not owner'));
    await expect(h.service.resolveForEvent('u_client', 'evt_1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.policy.requireCanReadEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'u_client' }), h.event, 'communication participant', {});
  });

  it('does not enumerate participant accounts for a client requester', async () => {
    const h = harness();
    await expect(h.service.listEligibleForEvent('evt_1', { id: 'u_client', name: 'Client', email: 'client@example.test', role: OpsUserRole.Client, explicit: true, verified: true })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
