import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, PrivacyRequestType } from '@prism/kernel/event-core';
import type { PlatformPrivacyInventory } from '@prism/contexts/read-models';
import { LifecyclePrivacyRedactorService } from '@prism/contexts/event-lifecycle';
import { CommercialPrivacyRedactorService } from '@prism/contexts/commercial';
import { OperationsPrivacyRedactorService } from '@prism/contexts/operations';
import { IdentityPrivacyRedactorService } from '@prism/contexts/identity-access';
import { PrivacyOperationsService } from './privacy-operations.service';
import {
  activeLegalHoldWhere,
  normalizePrivacyLegalHoldScope,
  privacyLegalHoldLockKeys,
  privacyRequestLegalHoldScope,
} from './privacy-legal-hold.policy';

const verifiedActor = {
  id: 'user_mys',
  role: OpsUserRole.PmcmAdmin,
  email: 'mys@pmcm.test',
  name: 'Mys',
  explicit: true,
  verified: true,
};

describe('PrivacyOperationsService', () => {
  it('uses normalized identity lock keys for placement, execution, and release across event scopes', () => {
    const placed = normalizePrivacyLegalHoldScope({
      subjectType: 'guest', subjectEmail: 'ignored@example.test', subjectName: '  Ana Reyes  ', eventId: ' evt_a ', reason: 'records hold',
    });
    const request = privacyRequestLegalHoldScope({
      subjectType: 'GUEST', subjectEmail: 'ignored@example.test', subjectName: 'ana reyes', eventId: 'evt_a',
    });
    const releasedRecord = { ...placed, subjectName: 'ANA REYES' };
    const otherEvent = { ...placed, eventId: 'evt_b' };

    expect(privacyLegalHoldLockKeys(placed)).toEqual(privacyLegalHoldLockKeys(request));
    expect(privacyLegalHoldLockKeys(releasedRecord)[0]).toBe(privacyLegalHoldLockKeys(request)[0]);
    expect(privacyLegalHoldLockKeys(placed)[1]).not.toBe(privacyLegalHoldLockKeys(otherEvent)[1]);
  });

  it('matches global and same-event holds while leaving another event out of a scoped deletion', () => {
    const scoped = normalizePrivacyLegalHoldScope({
      subjectType: 'client', subjectEmail: ' ANA@AYALA.TEST ', subjectName: '', eventId: 'evt_a', reason: 'records hold',
    });
    const global = { ...scoped, eventId: null };

    expect(activeLegalHoldWhere(scoped)).toEqual({
      subjectType: 'client',
      subjectEmail: 'ana@ayala.test',
      subjectName: '',
      releasedAt: null,
      OR: [{ eventId: null }, { eventId: 'evt_a' }],
    });
    expect(activeLegalHoldWhere(global)).not.toHaveProperty('OR');
    expect(activeLegalHoldWhere(global)).not.toHaveProperty('eventId');
  });

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
    const legalHold = {
      id: 'hold_1', subjectType: 'client', subjectEmail: 'ana@ayala.test', subjectName: '', eventId: 'evt_sample',
      reason: 'Preserve records', placedById: verifiedActor.id, placedByName: verifiedActor.name,
      placedAt: new Date('2026-09-03T00:00:00.000Z'), releaseReason: null, releasedById: null, releasedByName: null,
      releasedAt: null, createdAt: new Date('2026-09-03T00:00:00.000Z'),
    };
    const prisma = {
      opsPrivacyRequest: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...created, ...data })),
        findMany: vi.fn(async () => [created]),
      },
      opsPrivacyLegalHold: { findMany: vi.fn(async () => [legalHold]) },
    };
    const auditService = { audit: vi.fn(async () => undefined) };
    const platformReferences = {
      findEventReference: vi.fn(async (id: string): Promise<{ id: string } | null> => ({ id })),
      findPrivacyInventory: vi.fn(async (): Promise<PlatformPrivacyInventory> => ({ events: [], approvalRequests: [] })),
    };
    const rootPrisma = { ...prisma, $transaction: vi.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) };
    const service = new PrivacyOperationsService(
      rootPrisma as never,
      auditService as never,
      platformReferences as never,
      new LifecyclePrivacyRedactorService(),
      new CommercialPrivacyRedactorService(),
      new OperationsPrivacyRedactorService(),
      new IdentityPrivacyRedactorService(),
    );
    return { service, prisma, rootPrisma, auditService, platformReferences, created, legalHold };
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

  it('lists only active holds relevant to the selected event, including subject-wide holds', async () => {
    const { service, prisma, legalHold } = createService();

    const result = await service.listLegalHolds({ eventId: 'evt_sample' });

    expect(prisma.opsPrivacyLegalHold.findMany).toHaveBeenCalledWith({
      where: { releasedAt: null, OR: [{ eventId: null }, { eventId: 'evt_sample' }] },
      orderBy: { placedAt: 'desc' },
    });
    expect(result[0]).toMatchObject({ id: legalHold.id, subjectEmail: legalHold.subjectEmail, eventId: legalHold.eventId });
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
        guestRosterEntryCount: 3,
        guestFeedbackMedia: [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v2', marketingConsentAccepted: false }],
      }],
      approvalRequests: [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v3', marketingConsentAccepted: false }],
    });

    const result = await service.getInventory({ eventId: 'evt_sample' });

    expect(platformReferences.findPrivacyInventory).toHaveBeenCalledWith({ eventId: 'evt_sample' });
    expect(result.events[0]).toMatchObject({ eventId: 'evt_sample', recordCount: 8 });
    expect(result.events[0]?.surfaces.map(({ surface, consentAcceptedCount }) => [surface, consentAcceptedCount])).toEqual([
      ['inquiry', 1], ['guest_check_in', 1], ['guest_roster_entry', 0], ['guest_feedback', 1], ['guest_feedback_media_metadata', 1],
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
    const advisoryLockKeys: unknown[] = [];
    const legalHold = {
      id: 'hold_1', subjectType: 'client', subjectEmail: 'ana@ayala.test', subjectName: '', eventId: 'evt_sample',
      reason: 'Preserve records', placedById: verifiedActor.id, placedByName: verifiedActor.name,
      placedAt: new Date('2026-09-03T00:00:00.000Z'), releaseReason: null, releasedById: null, releasedByName: null,
      releasedAt: null, createdAt: new Date('2026-09-03T00:00:00.000Z'),
    };
    const tx = {
      $executeRaw: vi.fn(async (_strings: TemplateStringsArray, ...values: unknown[]) => {
        advisoryLockKeys.push(values[0]);
        return 0;
      }),
      opsPrivacyRequest: {
        findUnique: vi.fn(async () => request),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
      },
      opsUser: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => null) },
      opsInquiry: { findMany: vi.fn(async () => [{ id: 'inq_legacy' }]), updateMany: updateMany() },
      opsEvent: { findMany: vi.fn(async () => [{ id: 'evt_linked' }]), updateMany: updateMany() },
      opsBillingStatement: { updateMany: updateMany() },
      opsApprovalRequest: { updateMany: updateMany() },
      opsSupplier: { updateMany: updateMany() },
      opsSupplierApplication: { updateMany: updateMany() },
      opsGuestCheckIn: { updateMany: updateMany() },
      opsGuestFeedback: { updateMany: updateMany() },
      opsPrivacyLegalHold: {
        findFirst: vi.fn(async () => null as { id: string } | null),
        findUnique: vi.fn(async () => legalHold),
        findUniqueOrThrow: vi.fn(async () => legalHold),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(legalHold, data)),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          Object.assign(legalHold, data);
          return { count: 1 };
        }),
      },
    };
    // The root client deliberately has no models: execution must use the transaction client.
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)) };
    const auditService = { audit: vi.fn(async () => undefined) };
    const lifecyclePrivacy = new LifecyclePrivacyRedactorService();
    const commercialPrivacy = new CommercialPrivacyRedactorService();
    const operationsPrivacy = new OperationsPrivacyRedactorService();
    const identityPrivacy = new IdentityPrivacyRedactorService();
    const service = new PrivacyOperationsService(
      prisma as never,
      auditService as never,
      {
        findEventReference: vi.fn(async (id: string): Promise<{ id: string } | null> => ({ id })),
        findPrivacyInventory: vi.fn(async (): Promise<PlatformPrivacyInventory> => ({ events: [], approvalRequests: [] })),
      } as never,
      lifecyclePrivacy,
      commercialPrivacy,
      operationsPrivacy,
      identityPrivacy,
    );
    const execute = () => service.executeRequest(request.id, {}, verifiedActor);
    return { request, tx, rootPrisma: prisma, auditService, advisoryLockKeys, service, execute, lifecyclePrivacy, commercialPrivacy, operationsPrivacy, identityPrivacy };
  }

  it('places and releases a normalized hold with one shared lock order and audit receipts', async () => {
    const { service, tx, auditService, advisoryLockKeys } = executionFixture();
    const scope = normalizePrivacyLegalHoldScope({
      subjectType: 'client', subjectEmail: ' ANA@AYALA.TEST ', eventId: ' evt_sample ', reason: ' Preserve records ',
    });

    const hold = await service.createLegalHold({
      subjectType: 'client', subjectEmail: ' ANA@AYALA.TEST ', eventId: ' evt_sample ', reason: ' Preserve records ',
    }, verifiedActor);
    const released = await service.releaseLegalHold(hold.id, { reason: ' Counsel confirmed release ' }, verifiedActor);

    expect(hold).toMatchObject({ subjectEmail: 'ana@ayala.test', subjectName: '', eventId: 'evt_sample', reason: 'Preserve records' });
    expect(released).toMatchObject({ releaseReason: 'Counsel confirmed release', releasedById: verifiedActor.id });
    expect(advisoryLockKeys).toEqual([
      ...privacyLegalHoldLockKeys(scope), ...privacyLegalHoldLockKeys(scope),
    ]);
    expect(auditService.audit).toHaveBeenCalledTimes(2);
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_sample', verifiedActor.name, 'Placed privacy legal hold', expect.objectContaining({ affectedType: 'privacy_legal_hold' }),
      expect.objectContaining({ prisma: tx, correlationId: `privacy-legal-hold:${hold.id}:place` }),
    );
  });

  it('rejects legal-hold placement by an unverified or system actor before opening a transaction', async () => {
    const { service, rootPrisma } = executionFixture();
    const input = { subjectType: 'client' as const, subjectEmail: 'ana@ayala.test', reason: 'Preserve records' };

    await expect(service.createLegalHold(input, { ...verifiedActor, verified: false })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.createLegalHold(input, { ...verifiedActor, role: OpsUserRole.System })).rejects.toBeInstanceOf(ForbiddenException);
    expect(rootPrisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['access', 'correction'])('does not falsely execute an approved %s request', async (requestType) => {
    const { execute, request, tx, auditService } = executionFixture({ requestType });
    await expect(execute()).rejects.toThrow('not supported yet');
    expect(request.status).toBe('approved');
    expect(tx.opsPrivacyRequest.update).not.toHaveBeenCalled();
    expect(auditService.audit).not.toHaveBeenCalled();
  });

  it('keeps an approved deletion pending and performs no owner writes while a matching legal hold is active', async () => {
    const { execute, request, tx, auditService } = executionFixture();
    tx.opsPrivacyLegalHold.findFirst.mockResolvedValueOnce({ id: 'hold_1' });

    await expect(execute()).rejects.toThrow('active legal hold');

    expect(request.status).toBe('approved');
    expect(tx.opsInquiry.updateMany).not.toHaveBeenCalled();
    expect(tx.opsSupplier.updateMany).not.toHaveBeenCalled();
    expect(tx.opsGuestCheckIn.updateMany).not.toHaveBeenCalled();
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
      where: { id: { in: ['evt_linked'] } }, data: { clientName: 'Redacted data subject' },
    });
    expect(tx.opsBillingStatement.updateMany).toHaveBeenCalledWith({
      where: { eventId: { in: ['evt_linked'] } },
      data: { clientName: 'Redacted data subject', clientContact: redactedEmail },
    });
    expect(tx.opsSupplier.updateMany).not.toHaveBeenCalled();
    expect(tx.opsGuestCheckIn.updateMany).not.toHaveBeenCalled();
    expect(auditService.audit).toHaveBeenCalledWith(undefined, 'Mys', expect.any(String), expect.any(Object), expect.objectContaining({ prisma: tx }));
    expect(auditService.audit).toHaveBeenCalledWith(
      undefined,
      'Mys',
      'Privacy redaction receipt: event-lifecycle',
      expect.objectContaining({
        affectedType: 'privacy_owner_redaction_receipt',
        metadata: expect.objectContaining({
          owner: 'event-lifecycle', outcome: 'completed', surfaces: ['inquiry', 'event_client_copy'], touchedRecords: 2,
        }),
      }),
      expect.objectContaining({ prisma: tx, correlationId: 'privacy:priv_1:owner:event-lifecycle' }),
    );
  });

  it('delegates client redaction writes through owner capabilities in the execution transaction', async () => {
    const { execute, tx, lifecyclePrivacy, commercialPrivacy, identityPrivacy } = executionFixture({ subjectEmail: 'ANA@AYALA.TEST', eventId: null });
    const lifecycle = vi.spyOn(lifecyclePrivacy, 'redactClient');
    const commercial = vi.spyOn(commercialPrivacy, 'redactClientBilling');
    const identity = vi.spyOn(identityPrivacy, 'redactApprovalIdentity');

    await execute();

    expect(lifecycle).toHaveBeenCalledWith(
      { email: 'ana@ayala.test', redactedEmail: 'redacted+privacy_priv_1@privacy.local', eventId: null },
      tx,
    );
    expect(commercial).toHaveBeenCalledWith(
      { eventIds: ['evt_linked'], redactedEmail: 'redacted+privacy_priv_1@privacy.local' },
      tx,
    );
    expect(identity).toHaveBeenCalledWith(
      { email: 'ana@ayala.test', redactedEmail: 'redacted+privacy_priv_1@privacy.local', role: OpsUserRole.Client },
      tx,
    );
  });

  it('limits client matching to the requested event when one was selected', async () => {
    const { execute, tx } = executionFixture();
    await execute();
    expect(tx.opsInquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ events: { some: { id: 'evt_sample' } } }),
    }));
  });

  it('redacts supplier applications and contacts without touching client or guest namesakes', async () => {
    const { execute, tx, auditService } = executionFixture({ subjectType: 'supplier', eventId: null });
    await execute();
    expect(tx.opsSupplierApplication.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'redacted+privacy_priv_1@privacy.local', normalizedEmail: 'redacted+privacy_priv_1@privacy.local', phone: '' }),
    }));
    expect(tx.opsApprovalRequest.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ role: 'supplier' }) }));
    expect(tx.opsInquiry.findMany).not.toHaveBeenCalled();
    expect(tx.opsGuestFeedback.updateMany).not.toHaveBeenCalled();
    expect(auditService.audit).toHaveBeenCalledWith(
      undefined,
      'Mys',
      'Privacy redaction receipt: commercial',
      expect.objectContaining({ metadata: expect.objectContaining({ owner: 'commercial', outcome: 'completed' }) }),
      expect.objectContaining({ prisma: tx, correlationId: 'privacy:priv_1:owner:commercial' }),
    );
  });

  it('redacts a guest only inside the selected event even if an email was also supplied', async () => {
    const { execute, tx, auditService } = executionFixture({ subjectType: 'guest' });
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
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_sample',
      'Mys',
      'Privacy redaction receipt: operations',
      expect.objectContaining({ metadata: expect.objectContaining({ owner: 'operations', outcome: 'completed' }) }),
      expect.objectContaining({ prisma: tx, correlationId: 'privacy:priv_1:owner:operations' }),
    );
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
