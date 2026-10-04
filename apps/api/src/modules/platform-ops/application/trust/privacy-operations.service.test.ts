import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, PrivacyRequestType } from '@prism/kernel/event-core';
import type { PlatformPrivacyInventory } from '@prism/contexts/read-models';
import { PrivacyOperationsService } from './privacy-operations.service';

const verifiedActor = {
  id: 'user_mys',
  role: OpsUserRole.PmcmAdmin,
  email: 'mys@pmcm.test',
  name: 'Mys',
  explicit: true,
  verified: true,
};

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
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...created, ...data })),
        findMany: vi.fn(async () => [created]),
      },
    };
    const auditService = { audit: vi.fn(async () => undefined) };
    const platformReferences = {
      findEventReference: vi.fn(async (id: string): Promise<{ id: string } | null> => ({ id })),
      findPrivacyInventory: vi.fn(async (): Promise<PlatformPrivacyInventory> => ({ events: [], approvalRequests: [] })),
    };
    const rootPrisma = { ...prisma, $transaction: vi.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) };
    const service = new PrivacyOperationsService(rootPrisma as never, auditService as never, platformReferences as never);
    return { service, prisma, rootPrisma, auditService, platformReferences, created };
  }

  it('creates a submitted privacy request and writes an audit trail', async () => {
    const { service, prisma, auditService, platformReferences } = createService();

    const result = await service.createRequest(
      {
        subjectType: 'Client',
        subjectEmail: 'Ana@ayala.test',
        requestType: PrivacyRequestType.Access,
        requestNotes: 'Need a copy of stored inquiry data',
        eventId: 'evt_sample',
      },
      verifiedActor,
    );

    expect(result).toMatchObject({
      status: 'submitted',
      subjectEmail: 'ana@ayala.test',
      requestType: PrivacyRequestType.Access,
    });
    expect(prisma.opsPrivacyRequest.create).toHaveBeenCalledTimes(1);
    expect(platformReferences.findEventReference).toHaveBeenCalledWith('evt_sample');
    expect(prisma.opsPrivacyRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ createdBy: verifiedActor.name }),
    });
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_sample',
      'Mys',
      'Logged privacy request: access',
      expect.objectContaining({
        actorRole: verifiedActor.role,
        actorEmail: verifiedActor.email,
        affectedType: 'privacy_request',
        metadata: expect.objectContaining({ actorId: verifiedActor.id }),
      }),
      expect.objectContaining({ prisma, actorId: verifiedActor.id }),
    );
  });

  it('rejects an absent event reference before persisting a privacy request', async () => {
    const { service, prisma, platformReferences } = createService();
    platformReferences.findEventReference.mockResolvedValueOnce(null);

    await expect(service.createRequest({
      subjectType: 'client', subjectEmail: 'ana@ayala.test', eventId: 'evt_missing', requestType: PrivacyRequestType.Access,
    }, verifiedActor)).rejects.toThrow('Event not found');
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
  });

  it('builds event privacy inventory from the approved owner projection', async () => {
    const { service, platformReferences } = createService();
    platformReferences.findPrivacyInventory.mockResolvedValueOnce({
      events: [{
        id: 'evt_sample', eventName: 'Sample', clientName: 'Client', inquiryId: 'inq_1', eventDate: new Date('2030-01-01'),
        inquiry: { privacyConsentAccepted: true, privacyNoticeVersion: 'v1', marketingConsentAccepted: false },
        guestCheckIns: [
          { privacyConsentAccepted: true, privacyNoticeVersion: 'v1', marketingConsentAccepted: false },
          { privacyConsentAccepted: false, privacyNoticeVersion: '', marketingConsentAccepted: false },
        ],
        guestFeedback: [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v2', marketingConsentAccepted: true }],
      }],
      approvalRequests: [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v3', marketingConsentAccepted: false }],
    });

    const result = await service.getInventory({ eventId: 'evt_sample' });

    expect(platformReferences.findPrivacyInventory).toHaveBeenCalledWith({ eventId: 'evt_sample' });
    expect(result.events[0]).toMatchObject({ eventId: 'evt_sample', recordCount: 4 });
    expect(result.events[0]?.surfaces.map(({ surface, consentAcceptedCount }) => [surface, consentAcceptedCount])).toEqual([
      ['inquiry', 1], ['guest_check_in', 1], ['guest_feedback', 1],
    ]);
    expect(result.globalSurfaces[0]).toMatchObject({ recordCount: 1, consentAcceptedCount: 1 });
  });

  it('rejects unsupported privacy request types before writing', async () => {
    const { service, prisma } = createService();

    await expect(
      service.createRequest(
        { subjectType: 'client', subjectEmail: 'ana@ayala.test', requestType: 'erase-everything' },
        verifiedActor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
  });

  it('rejects privacy mutations from unverified actors before opening a transaction', async () => {
    const { service, prisma, rootPrisma } = createService();
    const unverifiedActor = { ...verifiedActor, verified: false };
    const validInput = {
      subjectType: 'client',
      subjectEmail: 'ana@ayala.test',
      requestType: PrivacyRequestType.Access,
    };

    await expect(service.createRequest(validInput, unverifiedActor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reviewRequest('priv_1', { status: 'approved' }, unverifiedActor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.executeRequest('priv_1', {}, unverifiedActor)).rejects.toBeInstanceOf(ForbiddenException);

    expect(rootPrisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.opsPrivacyRequest.create).not.toHaveBeenCalled();
  });

  function executionFixture(overrides: Record<string, string | null> = {}) {
    const { created } = createService();
    const request = { ...created, requestType: 'deletion', status: 'approved', ...overrides };
    const updateMany = () => vi.fn(async () => ({ count: 1 }));
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      opsPrivacyRequest: {
        findUnique: vi.fn(async () => request),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
      },
      opsUser: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => null) },
      opsInquiry: { findMany: vi.fn(async () => [{ id: 'inq_legacy' }]), updateMany: updateMany() },
      opsEvent: { updateMany: updateMany() },
      opsBillingStatement: { updateMany: updateMany() },
      opsApprovalRequest: { updateMany: updateMany() },
      opsSupplier: { updateMany: updateMany() },
      opsSupplierApplication: { updateMany: updateMany() },
      opsGuestCheckIn: { updateMany: updateMany() },
      opsGuestFeedback: { updateMany: updateMany() },
    };
    // The root client deliberately has no models: execution must use the transaction client.
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
    const auditService = { audit: vi.fn(async () => undefined) };
    const service = new PrivacyOperationsService(prisma as never, auditService as never, {
      findEventReference: vi.fn(async (id: string): Promise<{ id: string } | null> => ({ id })),
      findPrivacyInventory: vi.fn(async (): Promise<PlatformPrivacyInventory> => ({ events: [], approvalRequests: [] })),
    } as never);
    const execute = () => service.executeRequest(request.id, {}, verifiedActor);
    return { request, tx, auditService, execute };
  }

  it.each(['access', 'correction'])('does not falsely execute an approved %s request', async (requestType) => {
    const { execute, request, tx, auditService } = executionFixture({ requestType });
    await expect(execute()).rejects.toThrow('not supported yet');
    expect(request.status).toBe('approved');
    expect(tx.opsPrivacyRequest.update).not.toHaveBeenCalled();
    expect(auditService.audit).not.toHaveBeenCalled();
  });

  it('redacts both inquiry email columns and all linked structured client copies', async () => {
    const { execute, request, tx, auditService } = executionFixture({ subjectEmail: 'ANA@AYALA.TEST', eventId: null });
    await execute();
    expect(request.status).toBe('executed');
    const redactedEmail = 'redacted+privacy_priv_1@privacy.local';
    expect(tx.opsInquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      OR: [{ email: { equals: 'ana@ayala.test', mode: 'insensitive' } }, { normalizedEmail: 'ana@ayala.test' }],
    } }));
    expect(tx.opsInquiry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['inq_legacy'] } },
      data: expect.objectContaining({ email: redactedEmail, normalizedEmail: redactedEmail }),
    });
    expect(tx.opsEvent.updateMany).toHaveBeenCalledWith({
      where: { inquiryId: { in: ['inq_legacy'] } }, data: { clientName: 'Redacted data subject' },
    });
    expect(tx.opsBillingStatement.updateMany).toHaveBeenCalledWith({
      where: { event: { inquiryId: { in: ['inq_legacy'] } } },
      data: { clientName: 'Redacted data subject', clientContact: redactedEmail },
    });
    expect(tx.opsSupplier.updateMany).not.toHaveBeenCalled();
    expect(tx.opsGuestCheckIn.updateMany).not.toHaveBeenCalled();
    expect(auditService.audit).toHaveBeenCalledWith(undefined, 'Mys', expect.any(String), expect.any(Object), expect.objectContaining({ prisma: tx }));
  });

  it('limits client matching to the requested event when one was selected', async () => {
    const { execute, tx } = executionFixture();
    await execute();
    expect(tx.opsInquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ events: { some: { id: 'evt_sample' } } }),
    }));
  });

  it('redacts supplier applications and contacts without touching client or guest namesakes', async () => {
    const { execute, tx } = executionFixture({ subjectType: 'supplier', eventId: null });
    await execute();
    expect(tx.opsSupplierApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'redacted+privacy_priv_1@privacy.local', normalizedEmail: 'redacted+privacy_priv_1@privacy.local', phone: '' }),
    }));
    expect(tx.opsApprovalRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: 'supplier' }) }));
    expect(tx.opsInquiry.findMany).not.toHaveBeenCalled();
    expect(tx.opsGuestFeedback.updateMany).not.toHaveBeenCalled();
  });

  it('redacts a guest only inside the selected event even if an email was also supplied', async () => {
    const { execute, tx } = executionFixture({ subjectType: 'guest' });
    await execute();
    expect(tx.opsGuestCheckIn.updateMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_sample', guestName: { equals: 'Ana Reyes', mode: 'insensitive' } }, data: { guestName: 'Redacted guest' },
    });
    expect(tx.opsGuestFeedback.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: 'evt_sample', guestName: { equals: 'Ana Reyes', mode: 'insensitive' } },
      data: expect.objectContaining({ comment: '[redacted by privacy request]', photoFileName: null, videoFileName: null }),
    }));
    expect(tx.opsInquiry.findMany).not.toHaveBeenCalled();
    expect(tx.opsSupplier.updateMany).not.toHaveBeenCalled();
  });

  it.each(['account', 'unrecognized'])('leaves unsupported %s deletion approved', async (subjectType) => {
    const { execute, request } = executionFixture({ subjectType });
    await expect(execute()).rejects.toThrow('not supported');
    expect(request.status).toBe('approved');
  });

  it('does not declare deletion complete while a native account still identifies the subject', async () => {
    const { execute, request, tx } = executionFixture();
    tx.opsUser.findFirst.mockResolvedValue({ id: 'usr_subject' });
    await expect(execute()).rejects.toThrow('account deletion is not supported');
    expect(request.status).toBe('approved');
    expect(tx.opsInquiry.updateMany).not.toHaveBeenCalled();
  });

  it('does not mark an unmatched guest request executed', async () => {
    const { execute, request, tx } = executionFixture({ subjectType: 'guest' });
    tx.opsGuestCheckIn.updateMany.mockResolvedValue({ count: 0 });
    tx.opsGuestFeedback.updateMany.mockResolvedValue({ count: 0 });
    await expect(execute()).rejects.toThrow('No supported records matched');
    expect(request.status).toBe('approved');
  });
});
