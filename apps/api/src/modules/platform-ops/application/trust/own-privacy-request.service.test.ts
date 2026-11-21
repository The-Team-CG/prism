import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

function fixture({ openRequest = null as null | Record<string, unknown>, rows = [row()], updated = 1, after = row({ status: 'cancelled', reviewedAt: new Date('2026-11-08T08:00:00.000Z') }) } = {}) {
  const created = row({ identityConfirmedAt: new Date('2026-11-07T08:00:00.000Z'), identityMethod: 'account_password' });
  const prisma = {
    opsPrivacyRequest: {
      findFirst: vi.fn(async (_args: unknown) => openRequest),
      create: vi.fn(async (_args: { data: Record<string, unknown> }) => created),
      findMany: vi.fn(async (_args: unknown) => rows),
      updateMany: vi.fn(async (_args: unknown) => ({ count: updated })),
      findUniqueOrThrow: vi.fn(async (_args: unknown) => after),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...created, requestType: 'export', ...data })),
    },
    $executeRaw: vi.fn(async () => 0),
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  };
  const auditService = { audit: vi.fn(async () => undefined) };
  const passwords = {
    confirmPassword: vi.fn(async (_accountId: string, password: string) => {
      if (password !== 'right-password') throw new ForbiddenException('That password is not right.');
      return new Date('2026-11-07T08:00:00.000Z');
    }),
  };
  const privacyOperations = { exportAndAudit: vi.fn(async () => ({ requestId: 'priv_1', subjectType: 'client', generatedAt: '2026-11-07T08:00:00.000Z', sections: [] })) };
  const service = new OwnPrivacyRequestService(prisma as never, auditService as never, passwords, privacyOperations as never);
  return { service, prisma, auditService, passwords, privacyOperations };
}

describe('own privacy request service', () => {
  it('files a self-service request under the verified requester, not anything the caller supplied', async () => {
    const { service, prisma, auditService } = fixture();

    const result = await service.submit({ requestType: 'access', password: 'right-password' }, clientActor);

    const data = (prisma.opsPrivacyRequest.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({
      // Filed under the requester's own account, the subject PMCM can execute a deletion or correction against.
      subjectType: 'account',
      subjectEmail: 'ana@example.test',
      subjectName: 'Ana Reyes',
      requestType: 'access',
      status: 'submitted',
      source: 'self_service',
      eventId: null,
      createdBy: 'Ana Reyes',
      identityConfirmedAt: new Date('2026-11-07T08:00:00.000Z'),
      identityMethod: 'account_password',
    });
    expect(data).not.toHaveProperty('password');
    expect(JSON.stringify(auditService.audit.mock.calls)).not.toContain('right-password');
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
      outcomeMessage: 'You confirmed it is you with your password. PMCM is reviewing this request.',
      cancellable: true,
      identityConfirmedAt: '2026-11-07T08:00:00.000Z',
    });
    expect(result).not.toHaveProperty('requestNotes');
    expect(result).not.toHaveProperty('assignedTo');
  });

  it('confirms the requester\'s own password before filing, and files nothing when it is wrong', async () => {
    const { service, prisma, passwords } = fixture();

    await expect(service.submit({ requestType: 'access', password: 'guess' }, clientActor)).rejects.toBeInstanceOf(ForbiddenException);

    expect(passwords.confirmPassword).toHaveBeenCalledWith('usr_ana', 'guess');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
  });

  it("downloads the requester's own data once their password confirms it, and records it as a finished export", async () => {
    const { service, prisma, privacyOperations } = fixture();

    const download = await service.downloadOwn({ password: 'right-password' }, clientActor);

    const data = (prisma.opsPrivacyRequest.create.mock.calls[0] as unknown as [{ data: Record<string, unknown> }])[0].data;
    expect(data).toMatchObject({ requestType: 'export', subjectEmail: 'ana@example.test', subjectType: 'client', source: 'self_service', identityMethod: 'account_password' });
    expect(privacyOperations.exportAndAudit).toHaveBeenCalledWith(expect.objectContaining({ id: 'priv_1' }), expect.objectContaining({ id: 'usr_ana', email: 'ana@example.test' }), prisma);
    expect(prisma.opsPrivacyRequest.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'executed', executionNotes: 'Downloaded by the requester' }) }));
    expect(download.request).toMatchObject({ type: 'export', status: 'executed', cancellable: false, outcomeMessage: 'You downloaded this copy of your data yourself.' });
    expect(download.export.sections).toEqual([]);
  });

  it('downloads nothing and records nothing when the password is wrong', async () => {
    const { service, prisma, privacyOperations } = fixture();

    await expect(service.downloadOwn({ password: 'guess' }, clientActor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
    expect(privacyOperations.exportAndAudit).not.toHaveBeenCalled();
  });

  it('refuses a second open request of the same type from the same requester', async () => {
    const { service, prisma } = fixture({ openRequest: { id: 'priv_open' } });

    await expect(service.submit({ requestType: 'access', password: 'right-password' }, clientActor)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
  });

  it('checks for an open duplicate only among open statuses, for the same requester and type', async () => {
    const { service, prisma } = fixture();

    await service.submit({ requestType: 'deletion', password: 'right-password' }, supplierActor);

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
      await expect(service.submit({ requestType: 'access', password: 'right-password' }, actor)).rejects.toBeInstanceOf(ForbiddenException);
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

  it('lets the requester withdraw their own request only while PMCM has not reviewed it', async () => {
    const { service, prisma, auditService } = fixture({ openRequest: row() });

    const cancelled = await service.cancel('priv_1', clientActor);

    expect(prisma.opsPrivacyRequest.findFirst).toHaveBeenCalledWith({ where: { id: 'priv_1', subjectEmail: 'ana@example.test', subjectType: { in: ['client', 'account'] } } });
    expect(prisma.opsPrivacyRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'priv_1', status: 'submitted' }, data: expect.objectContaining({ status: 'cancelled' }) }));
    expect(auditService.audit).toHaveBeenCalledWith(undefined, 'Ana Reyes', 'Cancelled privacy request: access', expect.anything(), expect.objectContaining({ prisma }));
    expect(cancelled).toMatchObject({ status: 'cancelled', completedAt: '2026-11-08T08:00:00.000Z', cancellable: false, outcomeMessage: 'Cancelled by you before PMCM reviewed it.' });
  });

  it('refuses to cancel a request PMCM already started, or one that is not the requester\'s own', async () => {
    const started = fixture({ openRequest: row({ status: 'approved' }), updated: 0 });
    await expect(started.service.cancel('priv_1', clientActor)).rejects.toBeInstanceOf(ConflictException);
    expect(started.auditService.audit).not.toHaveBeenCalled();

    const notMine = fixture({ openRequest: null });
    await expect(notMine.service.cancel('priv_other', clientActor)).rejects.toBeInstanceOf(NotFoundException);
    expect(notMine.prisma.opsPrivacyRequest.updateMany).not.toHaveBeenCalled();
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
