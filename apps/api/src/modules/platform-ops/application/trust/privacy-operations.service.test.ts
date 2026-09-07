import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrivacyRequestType } from '@prism/kernel/event-core';
import { PrivacyOperationsService } from './privacy-operations.service';

describe('PrivacyOperationsService', () => {
  function createService() {
    const created = {
      id: 'priv_1',
      eventId: 'evt_sample',
      subjectType: 'client',
      subjectEmail: 'ana@ayala.test',
      subjectName: 'Ana Reyes',
      requestType: PrivacyRequestType.Access,
      status: 'submitted',
      requestNotes: 'Need a copy of stored inquiry data',
      reviewReason: '',
      executionNotes: '',
      createdBy: 'Mys',
      reviewedBy: null,
      reviewedAt: null,
      executedBy: null,
      executedAt: null,
      createdAt: new Date('2026-09-03T00:00:00.000Z'),
      updatedAt: new Date('2026-09-03T00:00:00.000Z'),
    };
    const prisma = {
      opsPrivacyRequest: {
        create: vi.fn(async () => created),
        findMany: vi.fn(async () => [created]),
      },
    };
    const auditService = { audit: vi.fn(async () => undefined) };
    const service = new PrivacyOperationsService(prisma as never, auditService as never);
    return { service, prisma, auditService, created };
  }

  it('creates a submitted privacy request and writes an audit trail', async () => {
    const { service, prisma, auditService } = createService();

    const result = await service.createRequest(
      {
        subjectType: 'Client',
        subjectEmail: 'Ana@ayala.test',
        requestType: PrivacyRequestType.Access,
        requestNotes: 'Need a copy of stored inquiry data',
        eventId: 'evt_sample',
      },
      { name: 'Mys', role: 'pmcm-admin' },
    );

    expect(result).toMatchObject({
      id: 'priv_1',
      status: 'submitted',
      subjectEmail: 'ana@ayala.test',
      requestType: PrivacyRequestType.Access,
    });
    expect(prisma.opsPrivacyRequest.create).toHaveBeenCalledTimes(1);
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_sample',
      'Mys',
      'Logged privacy request: access',
      expect.objectContaining({ affectedType: 'privacy_request' }),
    );
  });

  it('rejects unsupported privacy request types before writing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createRequest(
        { subjectType: 'client', subjectEmail: 'ana@ayala.test', requestType: 'erase-everything' },
        { name: 'Mys', role: 'pmcm-admin' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
  });

  it('leaves access execution unsupported and approved', async () => {
    const { service, created } = createService();
    const mutableCreated = created as { requestType: string; status: string };
    mutableCreated.status = 'approved';
    const execute = vi.fn(async () => { throw new Error('should not execute'); });
    (service as unknown as { prisma: Record<string, unknown> }).prisma = {
      $transaction: execute,
    };
    await expect(service.executeRequest(created.id, {}, { name: 'Mys', role: 'pmcm-admin' })).rejects.toThrow();
    expect(created.status).toBe('approved');
  });

  it('executes deletion atomically and redacts normalized linked copies', async () => {
    const { service, created, auditService } = createService();
    const mutableCreated = created as { requestType: string; status: string };
    mutableCreated.requestType = PrivacyRequestType.Deletion;
    mutableCreated.status = 'approved';
    const updates: string[] = [];
    const request = { ...created };
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      opsPrivacyRequest: {
        findUnique: vi.fn(async () => request),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
      },
      opsInquiry: { updateMany: vi.fn(async () => { updates.push('inquiry'); return { count: 1 }; }) },
      opsEvent: { updateMany: vi.fn(async () => { updates.push('event'); return { count: 1 }; }) },
      opsApprovalRequest: { updateMany: vi.fn(async () => ({ count: 0 })) },
      opsSupplier: { updateMany: vi.fn(async () => ({ count: 0 })) },
      opsSupplierApplication: { updateMany: vi.fn(async () => ({ count: 1 })) },
      opsGuestCheckIn: { updateMany: vi.fn(async () => ({ count: 0 })) },
      opsGuestFeedback: { updateMany: vi.fn(async () => ({ count: 0 })) },
      opsAuditLog: { findFirst: vi.fn(async () => null), create: vi.fn(async () => ({})) },
    };
    const prisma = (service as unknown as { prisma: Record<string, unknown> }).prisma;
    prisma.$transaction = vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx));
    await service.executeRequest(created.id, { executionNotes: 'verified' }, { name: 'Mys', role: 'pmcm-admin' });
    expect(updates).toEqual(['inquiry', 'event']);
    expect(request.status).toBe('executed');
    expect(auditService.audit).toHaveBeenCalledWith(expect.anything(), 'Mys', expect.anything(), expect.anything(), expect.objectContaining({ prisma: tx }));
  });
});
