import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { ParticipantReaderService } from './participant-reader.service';

function harness(overrides: Record<string, unknown> = {}) {
  const user = { id: 'u_client', name: 'Client', email: 'client@example.test', role: OpsUserRole.Client, approvalStatus: 'approved' };
  const facts = { event: { id: 'evt_1', clientPortalStatus: 'unlocked', clientName: 'Client', inquiryEmail: user.email as string | null }, supplierAssignments: [] as Array<{ supplierId: string | null; status: string }>, suppliers: [] as Array<{ id: string; email: string }>, coordinatorAssignments: [] as Array<{ coordinatorId: string | null; status: string }>, coordinators: [] as Array<{ id: string; userId: string | null }> };
  const prisma = { opsUser: { findUnique: vi.fn(async (): Promise<Record<string, unknown> | null> => ({ ...user, ...overrides })), findMany: vi.fn(async (): Promise<Array<{ id: string; name: string; email: string; role: string }>> => []) } };
  const factsReader = { findForEvent: vi.fn(async () => facts) };
  const policy = { requireCanReadEvent: vi.fn(async () => undefined) };
  return { service: new ParticipantReaderService(prisma as never, policy as never, factsReader as never), prisma, factsReader, policy, user, facts };
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
    expect(h.policy.requireCanReadEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'u_client' }), expect.objectContaining({ id: 'evt_1', inquiry: { email: 'client@example.test' } }), 'communication participant', {});
  });

  it('does not enumerate participant accounts for a client requester', async () => {
    const h = harness();
    await expect(h.service.listEligibleForEvent('evt_1', { id: 'u_client', name: 'Client', email: 'client@example.test', role: OpsUserRole.Client, explicit: true, verified: true })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found when the event fact is absent', async () => {
    const h = harness(); h.factsReader.findForEvent.mockResolvedValueOnce(null as never);
    await expect(h.service.resolveForEvent('u_client', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resolves a supplier onboarded with mixed-case email', async () => {
    const h = harness({ id: 'u_supplier', name: 'Supplier', email: 'Foo@Bar.com', role: OpsUserRole.Supplier });
    h.facts.supplierAssignments = [{ supplierId: 'sup_assigned', status: 'confirmed' }];
    h.facts.suppliers = [{ id: 'sup_unassigned', email: 'foo@bar.com' }, { id: 'sup_assigned', email: 'foo@bar.com' }];
    await expect(h.service.resolveForEvent('u_supplier', 'evt_1')).resolves.toMatchObject({ supplierId: 'sup_assigned' });
    expect(h.factsReader.findForEvent).toHaveBeenCalledWith('evt_1', undefined);
  });

  it('fails closed when client inquiry contact is missing or does not match', async () => {
    const missing = harness(); missing.facts.event.inquiryEmail = null;
    await expect(missing.service.resolveForEvent('u_client', 'evt_1')).rejects.toBeInstanceOf(ForbiddenException);
    const mismatch = harness(); mismatch.facts.event.inquiryEmail = 'other@example.test';
    await expect(mismatch.service.resolveForEvent('u_client', 'evt_1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an active supplier request and coordinator assignment', async () => {
    const supplier = harness({ id: 'u_supplier', name: 'Supplier', email: 'supplier@example.test', role: OpsUserRole.Supplier });
    supplier.facts.suppliers = [{ id: 'sup_1', email: 'supplier@example.test' }];
    supplier.facts.supplierAssignments = [{ supplierId: 'sup_1', status: 'cancelled' }];
    await expect(supplier.service.resolveForEvent('u_supplier', 'evt_1')).rejects.toBeInstanceOf(ForbiddenException);

    const coordinator = harness({ id: 'u_coordinator', name: 'Coordinator', email: 'coord@example.test', role: OpsUserRole.Coordinator });
    coordinator.facts.coordinators = [{ id: 'coord_1', userId: 'u_coordinator' }];
    coordinator.facts.coordinatorAssignments = [{ coordinatorId: 'coord_1', status: 'cancelled' }];
    await expect(coordinator.service.resolveForEvent('u_coordinator', 'evt_1')).rejects.toBeInstanceOf(ForbiddenException);
    coordinator.facts.coordinatorAssignments = [{ coordinatorId: 'coord_1', status: 'assigned' }];
    await expect(coordinator.service.resolveForEvent('u_coordinator', 'evt_1')).resolves.toMatchObject({ coordinatorId: 'coord_1', eventId: 'evt_1' });
  });

  it('loads the event once while enumerating all eligible participants', async () => {
    const h = harness();
    h.prisma.opsUser.findMany = vi.fn(async () => [
      { id: 'u_client', name: 'Client', email: 'client@example.test', role: OpsUserRole.Client },
      { id: 'u_supplier', name: 'Supplier', email: 'supplier@example.test', role: OpsUserRole.Supplier },
      { id: 'u_coord', name: 'Coordinator', email: 'coord@example.test', role: OpsUserRole.Coordinator },
    ]);
    h.facts.suppliers = [{ id: 'sup_1', email: 'supplier@example.test' }];
    h.facts.supplierAssignments = [{ supplierId: 'sup_1', status: 'confirmed' }, { supplierId: 'sup_cancelled', status: 'cancelled' }];
    h.facts.coordinators = [{ id: 'coord_1', userId: 'u_coord' }];
    h.facts.coordinatorAssignments = [{ coordinatorId: 'coord_1', status: 'cancelled' }];
    await expect(h.service.listEligibleForEvent('evt_1', { id: 'admin', name: 'Admin', email: 'admin@example.test', role: OpsUserRole.PmcmAdmin, explicit: true, verified: true })).resolves.toHaveLength(2);
    expect(h.factsReader.findForEvent).toHaveBeenCalledTimes(1);
    expect(h.prisma.opsUser.findUnique).not.toHaveBeenCalled();
  });

  it('passes the caller transaction to event facts and identity lookup', async () => {
    const h = harness();
    const tx = { opsUser: { findUnique: vi.fn(async () => ({ ...h.user })) } };
    await h.service.resolveForEvent('u_client', 'evt_1', tx as never);
    expect(tx.opsUser.findUnique).toHaveBeenCalledTimes(1);
    expect(h.factsReader.findForEvent).toHaveBeenCalledWith('evt_1', tx);
  });
});
