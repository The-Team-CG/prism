import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ParticipantReaderService } from './participant-reader.service';

function harness(overrides: Record<string, unknown> = {}) {
  const user = { id: 'u_client', name: 'Client', email: 'client@example.test', role: OpsUserRole.Client, approvalStatus: 'approved' };
  const event: { id: string; clientPortalStatus: string; clientName: string; inquiry: { email: string }; supplierQuoteRequests: Array<{ supplierId: string; assignmentStatus: string }>; coordinatorAssignments: Array<{ coordinatorId: string; status: string }> } = { id: 'evt_1', clientPortalStatus: 'unlocked', clientName: 'Client', inquiry: { email: user.email }, supplierQuoteRequests: [], coordinatorAssignments: [] };
  const prisma = { opsUser: { findUnique: vi.fn(async (): Promise<Record<string, unknown> | null> => ({ ...user, ...overrides })), findMany: vi.fn(async (): Promise<Array<{ id: string; name: string; email: string; role: string }>> => []) }, opsEvent: { findUnique: vi.fn(async () => event) }, opsSupplier: { findFirst: vi.fn(), findMany: vi.fn(async (): Promise<Array<{ id: string; email: string }>> => []) }, opsCoordinator: { findUnique: vi.fn(), findMany: vi.fn(async (): Promise<Array<{ id: string; userId: string | null }>> => []) } };
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

  it('resolves a supplier onboarded with mixed-case email', async () => {
    const h = harness({ id: 'u_supplier', name: 'Supplier', email: 'Foo@Bar.com', role: OpsUserRole.Supplier });
    h.event.supplierQuoteRequests = [{ supplierId: 'sup_1', assignmentStatus: 'confirmed' }];
    h.prisma.opsSupplier.findFirst.mockResolvedValue({ id: 'sup_1' });
    await expect(h.service.resolveForEvent('u_supplier', 'evt_1')).resolves.toMatchObject({ supplierId: 'sup_1' });
    expect(h.prisma.opsSupplier.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: { equals: 'foo@bar.com', mode: 'insensitive' } } }));
  });

  it('loads the event once while enumerating all eligible participants', async () => {
    const h = harness();
    h.prisma.opsUser.findMany = vi.fn(async () => [
      { id: 'u_client', name: 'Client', email: 'client@example.test', role: OpsUserRole.Client },
      { id: 'u_supplier', name: 'Supplier', email: 'supplier@example.test', role: OpsUserRole.Supplier },
    ]);
    h.prisma.opsSupplier.findMany = vi.fn(async () => [{ id: 'sup_1', email: 'supplier@example.test' }]);
    h.prisma.opsCoordinator.findMany = vi.fn(async () => []);
    h.event.supplierQuoteRequests = [{ supplierId: 'sup_1', assignmentStatus: 'confirmed' }];
    h.event.supplierQuoteRequests.push({ supplierId: 'sup_cancelled', assignmentStatus: 'cancelled' });
    await expect(h.service.listEligibleForEvent('evt_1', { id: 'admin', name: 'Admin', email: 'admin@example.test', role: OpsUserRole.PmcmAdmin, explicit: true, verified: true })).resolves.toHaveLength(2);
    expect(h.prisma.opsEvent.findUnique).toHaveBeenCalledTimes(1);
    expect(h.prisma.opsSupplier.findMany).toHaveBeenCalledWith({ where: { id: { in: ['sup_1'] } }, select: { id: true, email: true } });
    expect(h.prisma.opsUser.findUnique).not.toHaveBeenCalled();
  });
});
