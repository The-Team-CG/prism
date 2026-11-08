import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { OWN_PRIVACY_REQUEST_LIST_LIMIT, OwnPrivacyRequestService } from './own-privacy-request.service';

const clientActor = { id: 'usr_ana', role: OpsUserRole.Client, email: 'Ana@Example.test', name: 'Ana Reyes', explicit: true, verified: true };
const supplierActor = { id: 'usr_supplier', role: OpsUserRole.Supplier, email: 'ops@supplier.test', name: 'Supplier Co', explicit: true, verified: true };

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'priv_1', eventId: null, subjectType: 'client', subjectEmail: 'ana@example.test', subjectName: 'Ana Reyes',
    requestType: 'access', status: 'submitted', requestNotes: 'internal PMCM note', reviewReason: 'internal review',
    executionNotes: 'internal execution', createdBy: 'Maxine', reviewedBy: 'Maxine', reviewedAt: null,
    executedBy: null, executedAt: null, dueAt: new Date('2026-12-07T08:00:00.000Z'), assignedTo: 'usr_francis', source: 'self_service',
    createdAt: new Date('2026-11-07T08:00:00.000Z'), updatedAt: new Date('2026-11-07T08:00:00.000Z'),
    ...overrides,
  };
}

function fixture({ openRequest = null as null | { id: string }, rows = [row()] } = {}) {
  const created = row();
  const prisma = {
    opsPrivacyRequest: {
      findFirst: vi.fn(async (_args: unknown) => openRequest),
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => created),
      findMany: vi.fn(async (_args: unknown) => rows),
    },
    $executeRaw: vi.fn(async () => 0),
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  };
  const auditService = { audit: vi.fn(async () => undefined) };
  const service = new OwnPrivacyRequestService(prisma as never, auditService as never);
  return { service, prisma, auditService };
}

describe('own privacy request service', () => {
  it('files a self-service request under the verified requester, not anything the caller supplied', async () => {
    const { service, prisma, auditService } = fixture();

    const result = await service.submit({ requestType: 'access' }, clientActor);

    const data = (prisma.opsPrivacyRequest.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({
      subjectType: 'client',
      subjectEmail: 'ana@example.test',
      subjectName: 'Ana Reyes',
      requestType: 'access',
      status: 'submitted',
      source: 'self_service',
      eventId: null,
      createdBy: 'Ana Reyes',
    });
    expect(new Date(data.dueAt as Date).getTime() - new Date(data.createdAt as Date).getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    expect(auditService.audit).toHaveBeenCalledWith(
      undefined, 'Ana Reyes', 'Logged privacy request: access',
      expect.objectContaining({ actionType: 'create', affectedType: 'privacy_request', metadata: expect.objectContaining({ source: 'self_service' }) }),
      expect.objectContaining({ prisma }),
    );
    expect(result).toEqual({
      id: 'priv_1',
      type: 'access',
      status: 'submitted',
      submittedAt: '2026-11-07T08:00:00.000Z',
      dueAt: '2026-12-07T08:00:00.000Z',
      completedAt: null,
      outcomeMessage: 'Received. PMCM verifies your identity before acting on this request.',
    });
    expect(result).not.toHaveProperty('requestNotes');
    expect(result).not.toHaveProperty('assignedTo');
  });

  it('refuses a second open request of the same type from the same requester', async () => {
    const { service, prisma } = fixture({ openRequest: { id: 'priv_open' } });

    await expect(service.submit({ requestType: 'access' }, clientActor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
  });

  it('checks for an open duplicate only among open statuses, for the same requester and type', async () => {
    const { service, prisma } = fixture();

    await service.submit({ requestType: 'deletion' }, supplierActor);

    const where = (prisma.opsPrivacyRequest.findFirst.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where).toMatchObject({
      subjectEmail: 'ops@supplier.test',
      subjectType: { in: ['supplier', 'account'] },
      requestType: 'deletion',
      status: { in: ['submitted', 'approved'] },
    });
  });

  it('refuses PMCM, system, coordinator, and guest actors and an unverified client token', async () => {
    const { service, prisma } = fixture();
    const refused = [
      { ...clientActor, role: OpsUserRole.PmcmAdmin },
      { ...clientActor, role: OpsUserRole.System },
      { ...clientActor, role: OpsUserRole.Coordinator },
      { ...clientActor, role: OpsUserRole.Guest },
      { ...clientActor, verified: false },
    ];

    for (const actor of refused) {
      await expect(service.submit({ requestType: 'access' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.listOwn(actor)).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
    expect(prisma.opsPrivacyRequest.findMany).not.toHaveBeenCalled();
  });

  it('lists only the requester\'s own requests, bounded, and hides PMCM-internal fields', async () => {
    const { service, prisma } = fixture();

    const requests = await service.listOwn(supplierActor);

    expect(prisma.opsPrivacyRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { subjectEmail: 'ops@supplier.test', subjectType: { in: ['supplier', 'account'] } },
      take: OWN_PRIVACY_REQUEST_LIST_LIMIT,
    }));
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toHaveProperty('requestNotes');
    expect(requests[0]).not.toHaveProperty('reviewReason');
    expect(requests[0]).not.toHaveProperty('assignedTo');
    expect(JSON.stringify(requests)).not.toContain('internal');
  });

  it('shows a rejected request as closed with the review date and a non-revealing message', async () => {
    const { service } = fixture({
      rows: [row({ status: 'rejected', reviewedAt: new Date('2026-11-10T08:00:00.000Z'), reviewReason: 'internal reason' })],
    });

    const [request] = await service.listOwn(clientActor);

    expect(request).toMatchObject({
      status: 'rejected',
      completedAt: '2026-11-10T08:00:00.000Z',
      outcomeMessage: 'Closed without action. Contact PMCM if you need more detail.',
    });
    expect(JSON.stringify(request)).not.toContain('internal reason');
  });
});
