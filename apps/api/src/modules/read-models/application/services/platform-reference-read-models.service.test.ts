import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { PlatformReferenceReadModelsService } from './platform-reference-read-models.service';

describe('PlatformReferenceReadModelsService', () => {
  it('returns only the event id for privacy request reference validation', async () => {
    const findUnique = vi.fn(async () => ({ id: 'evt_1' }));
    const service = new PlatformReferenceReadModelsService({ opsEvent: { findUnique } } as unknown as PrismaService);

    await expect(service.findEventReference('evt_1')).resolves.toEqual({ id: 'evt_1' });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'evt_1' }, select: { id: true } });
  });

  it('composes the privacy inventory from event and consent facts only', async () => {
    const eventDate = new Date('2030-01-01T00:00:00.000Z');
    const opsEvent = { findMany: vi.fn(async () => [{ id: 'evt_1', eventName: 'Event', clientName: 'Client', inquiryId: 'inq_1', eventDate }]) };
    const opsInquiry = { findMany: vi.fn(async () => [{ id: 'inq_1', privacyConsentAccepted: true, privacyNoticeVersion: 'v1', marketingConsentAccepted: false }]) };
    const opsGuestCheckIn = { findMany: vi.fn(async () => [{ eventId: 'evt_1', privacyConsentAccepted: false, privacyNoticeVersion: '', marketingConsentAccepted: false }]) };
    const opsGuestFeedback = { findMany: vi.fn(async () => [{ eventId: 'evt_1', privacyConsentAccepted: true, privacyNoticeVersion: 'v2', marketingConsentAccepted: true }]) };
    const opsGuestRosterEntry = { findMany: vi.fn(async () => [{ eventId: 'evt_1' }]) };
    const opsGuestFeedbackMedia = { findMany: vi.fn(async () => [{ feedback: { eventId: 'evt_1', privacyConsentAccepted: true, privacyNoticeVersion: 'v2', marketingConsentAccepted: false } }]) };
    const opsApprovalRequest = { findMany: vi.fn(async () => [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v3', marketingConsentAccepted: false }]) };
    const opsBillingStatement = { groupBy: vi.fn(async () => [{ eventId: 'evt_1', _count: { _all: 2 } }]) };
    const opsPaymentRecord = { groupBy: vi.fn(async () => []) };
    const service = new PlatformReferenceReadModelsService({ opsEvent, opsInquiry, opsGuestCheckIn, opsGuestFeedback, opsGuestRosterEntry, opsGuestFeedbackMedia, opsApprovalRequest, opsBillingStatement, opsPaymentRecord } as unknown as PrismaService);

    await expect(service.findPrivacyInventory({ eventId: 'evt_1' })).resolves.toEqual({
      events: [{
        id: 'evt_1', eventName: 'Event', clientName: 'Client', inquiryId: 'inq_1', eventDate,
        inquiry: { privacyConsentAccepted: true, privacyNoticeVersion: 'v1', marketingConsentAccepted: false },
        guestCheckIns: [{ privacyConsentAccepted: false, privacyNoticeVersion: '', marketingConsentAccepted: false }],
        guestFeedback: [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v2', marketingConsentAccepted: true }],
        guestRosterEntryCount: 1,
        guestFeedbackMedia: [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v2', marketingConsentAccepted: false }],
        billingStatementCount: 2,
        paymentRecordCount: 0,
      }],
      approvalRequests: [{ privacyConsentAccepted: true, privacyNoticeVersion: 'v3', marketingConsentAccepted: false }],
    });
    expect(opsEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'evt_1' } }));
    expect(opsInquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['inq_1'] } } }));
    expect(opsGuestCheckIn.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: { in: ['evt_1'] } } }));
    expect(opsBillingStatement.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: { in: ['evt_1'] } } }));
  });

  it('returns the event scope that file access resolves against, with current coordinator assignments and quote status', async () => {
    const findUnique = vi.fn(async () => ({
      id: 'evt_1',
      archived: false,
      clientName: 'Client',
      clientPortalStatus: 'unlocked',
      inquiry: { email: 'client@example.test' },
    }));
    const requestFindMany = vi.fn(async () => [
      { supplierId: 'supplier_1', status: 'selected', supplier: { email: 'supplier@example.test' } },
      { supplierId: null, status: 'declined', supplier: null },
    ]);
    const assignmentFindMany = vi.fn(async () => [
      { coordinatorId: 'coord_1', coordinator: { userId: 'user_coord', email: 'coord@example.test' } },
    ]);
    const service = new PlatformReferenceReadModelsService({
      opsEvent: { findUnique },
      opsSupplierQuoteRequest: { findMany: requestFindMany },
      opsCoordinatorAssignment: { findMany: assignmentFindMany },
    } as unknown as PrismaService);

    await expect(service.findStorageEventScope('evt_1')).resolves.toEqual({
      id: 'evt_1',
      archived: false,
      clientName: 'Client',
      clientPortalStatus: 'unlocked',
      clientEmail: 'client@example.test',
      coordinatorAssignments: [{ coordinatorId: 'coord_1', coordinator: { userId: 'user_coord', email: 'coord@example.test' } }],
      supplierQuoteRequests: [
        { supplierId: 'supplier_1', status: 'selected', supplier: { email: 'supplier@example.test' } },
        { supplierId: null, status: 'declined', supplier: null },
      ],
    });
    expect(requestFindMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1' },
      select: { supplierId: true, status: true, supplier: { select: { email: true } } },
    });
    expect(assignmentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventId: 'evt_1' }),
    }));
  });

  it('rejects missing or mismatched PARE event references before reading dependent data', async () => {
    const findMany = vi.fn();
    const eventFindUnique = vi.fn(async () => ({ id: 'evt_actual', eventDate: new Date('2030-01-01T00:00:00Z'), eventName: 'Event', clientName: 'Client' }));
    const service = new PlatformReferenceReadModelsService({
      opsEvent: { findUnique: eventFindUnique },
      opsSupplierQuoteRequest: {
        findUnique: vi.fn(async () => ({
          id: 'request_1', eventId: 'evt_expected', assignmentStatus: 'withdrawn', supplierId: 'supplier_1',
          supplierName: 'Supplier', category: 'catering', supplier: { tier: 'tier_1' },
        })),
      },
      opsSupplierQuote: { findMany },
      opsBriefing: { findMany },
    } as unknown as PrismaService);

    await expect(service.findPareEventSource('request_1')).resolves.toBeNull();
    expect(findMany).not.toHaveBeenCalled();
  });

  it('maps minimal supplier facts and omits unused history and certification graphs', async () => {
    const findMany = vi.fn(async (_query: Record<string, unknown>) => [{
      id: 'supplier_2',
      name: 'Supplier Two',
      tier: 'tier_1',
      serviceInclusions: 'Halal catering',
      performanceNotes: 'Reliable',
      reviews: [{ rating: 5 }, { rating: 3 }],
      quoteRequests: [{ assignmentStatus: 'confirmed' }],
      quotes: [{ amount: '1250.50' }],
    }]);
    const service = new PlatformReferenceReadModelsService({
      opsSupplierCategory: { findFirst: vi.fn(async () => ({ id: 'category_1' })) },
      opsSupplier: { findMany },
    } as unknown as PrismaService);

    await expect(service.findPareSupplierCandidates({
      category: 'catering', withdrawnSupplierId: 'supplier_1', withdrawnSupplierName: 'Supplier One', eventId: 'evt_1',
    })).resolves.toEqual([{
      id: 'supplier_2',
      name: 'Supplier Two',
      tier: 'tier_1',
      serviceInclusions: 'Halal catering',
      performanceNotes: 'Reliable',
      reviewRatings: [5, 3],
      confirmedOnEvent: true,
      eventQuoteAmount: 1250.5,
    }]);
    const query = findMany.mock.calls[0]?.[0] as unknown as { select: Record<string, unknown> };
    expect(query.select).not.toHaveProperty('reliabilityNotes');
    expect(query.select).not.toHaveProperty('certifications');
    expect(query.select).toHaveProperty('quotes.take', 1);
  });

  it('normalizes the first approved trust recipient address', async () => {
    const findFirst = vi.fn(async () => ({ email: '  TRUST@example.test  ' }));
    const service = new PlatformReferenceReadModelsService({ opsUser: { findFirst } } as unknown as PrismaService);

    await expect(service.findApprovedTrustRecipientEmail()).resolves.toBe('trust@example.test');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: 'pmcm-admin', approvalStatus: 'approved' },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    }));
  });

  it('only resolves a privacy assignee that is an approved, unlocked PMCM administrator', async () => {
    const findFirst = vi.fn(async () => null);
    const service = new PlatformReferenceReadModelsService({ opsUser: { findFirst } } as unknown as PrismaService);

    await expect(service.findApprovedPmcmOperator('usr_coordinator')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'usr_coordinator', role: 'pmcm-admin', approvalStatus: 'approved', permanentLockout: false },
      select: { id: true, name: true },
    });
  });
});
