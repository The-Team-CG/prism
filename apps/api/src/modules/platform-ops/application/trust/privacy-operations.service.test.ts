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
});
