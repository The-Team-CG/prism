import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsBillingController } from './billing.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsBillingController', () => {
  it('keeps the public billing route base stable under event-read-models ownership', () => {
    expect(controllerPath(OpsBillingController)).toBe('billing');
  });

  it('serves billing through EventReadModelsService and the shared billing mappers', async () => {
    const eventReadModelsService = {
      billing: vi.fn(async (_actor, mappers) => ({
        events: [
          mappers.mapEvent({
            id: 'evt_sample',
            inquiryId: 'inq_sample',
            clientName: 'Ana Reyes',
            eventName: 'Ayala Summit',
            eventDate: new Date('2026-07-10T00:00:00.000Z'),
            status: 'planning',
            clientPortalStatus: 'unlocked',
            readiness: 'Planning',
            archived: false,
            floorPlanStatus: 'pmcm_draft',
            floorPlanId: 'plan_active',
            floorPlanDrafts: [
              {
                id: 'fpd_active',
                eventId: 'evt_sample',
                floorPlanId: 'plan_active',
                name: 'Main layout',
                status: 'pmcm_draft',
                isActive: true,
                sourceType: 'pmcm',
                createdByRole: 'pmcm-admin',
                clientPreference: null,
                submittedAt: null,
                reviewedAt: null,
                approvedAt: null,
                createdAt: new Date('2026-06-20T00:00:00.000Z'),
                updatedAt: new Date('2026-06-20T00:00:00.000Z'),
              },
            ],
          }),
        ],
        billingSources: [mappers.mapBillingSource({ id: 'bsrc_1', eventId: 'evt_sample', sourceType: 'proposal', sourceLabel: 'Approved source', sourceDocumentId: null, lineItems: [], paymentSchedule: [], paymentMethods: [], totalAmount: 100000, status: 'approved', approvedAt: new Date('2026-06-20T00:00:00.000Z'), approvedBy: 'Maxine', approvalNotes: '', paymentTermsPolicyState: 'standard', paymentTermsOverrideReason: null, paymentTermsApprovedBy: null, createdAt: new Date('2026-06-20T00:00:00.000Z'), updatedAt: new Date('2026-06-20T00:00:00.000Z') })],
        billingStatements: [mappers.mapBillingStatement({ id: 'bill_1', eventId: 'evt_sample', number: 'BS-2026-0001', clientName: 'Ana Reyes', clientContact: 'ana@example.test', eventName: 'Ayala Summit', eventDate: null, lineItems: [], paymentSchedule: [], paymentMethods: [], totalAmount: 100000, documentId: null, pdfUrl: '', storageKey: '', storageObjectId: null, storageState: 'stored', status: 'issued', sentAt: null, generatedAt: new Date('2026-06-20T00:00:00.000Z') })],
        paymentMilestones: [mappers.mapPaymentMilestone({ id: 'pay_1', eventId: 'evt_sample', label: 'Deposit', percentage: 50, amount: 100000, amountPaid: 25000, remainingBalance: 75000, dueDate: new Date('2026-07-01T00:00:00.000Z'), status: 'partially_paid' }, [{ id: 'prec_1', eventId: 'evt_sample', milestoneId: 'pay_1', amountReceived: 25000, paymentDate: new Date('2026-06-20T00:00:00.000Z'), paymentMethod: 'Bank Transfer', referenceNumber: 'REF-1', recordedAt: new Date('2026-06-20T01:00:00.000Z') }])],
        paymentRecords: [mappers.mapPaymentRecord({ id: 'prec_1', eventId: 'evt_sample', milestoneId: 'pay_1', amountReceived: 25000, paymentDate: new Date('2026-06-20T00:00:00.000Z'), paymentMethod: 'Bank Transfer', referenceNumber: 'REF-1', recordedAt: new Date('2026-06-20T01:00:00.000Z') })],
      })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input: any, verified: any) => ({
        role: verified.actorRole,
        clientName: verified.actorRole === 'client' ? verified.actorName : undefined,
        name: verified.actorName,
      })),
    };
    const controller = new OpsBillingController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
    );
    const verifiedActor = {
      id: 'user_client',
      actorId: 'user_client',
      role: 'client',
      actorRole: 'client',
      email: 'ana@ayala.test',
      actorEmail: 'ana@ayala.test',
      name: 'Ana Reyes',
      actorName: 'Ana Reyes',
      expiresAt: '2026-07-03T12:00:00.000Z',
    };

    const result = await controller.list(verifiedActor as any);

    expect(result.events[0]).toMatchObject({
      id: 'evt_sample',
      eventDate: '2026-07-10',
      activeFloorPlanDraftId: 'fpd_active',
      guestAccessCode: 'AYALA-SUMMIT-MPLE',
    });
    expect(result.billingSources).toEqual([expect.objectContaining({ id: 'bsrc_1', sourceLabel: 'Approved source', totalAmount: 100000 })]);
    expect(result.billingStatements).toEqual([expect.objectContaining({ id: 'bill_1', number: 'BS-2026-0001', status: 'issued' })]);
    expect(result.paymentMilestones).toEqual([expect.objectContaining({ id: 'pay_1', amountPaid: 25000, remainingBalance: 75000, history: [expect.objectContaining({ id: 'prec_1', referenceNumber: 'REF-1' })] })]);
    expect(result.paymentRecords).toEqual([expect.objectContaining({ id: 'prec_1', amountReceived: 25000, referenceNumber: 'REF-1' })]);
    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(eventReadModelsService.billing).toHaveBeenCalledWith(
      { role: 'client', clientName: 'Ana Reyes', name: 'Ana Reyes' },
      expect.objectContaining({
        mapEvent: expect.any(Function),
        mapBillingSource: expect.any(Function),
        mapBillingStatement: expect.any(Function),
        mapPaymentMilestone: expect.any(Function),
        mapPaymentRecord: expect.any(Function),
      }),
    );
  });

  it.each(['supplier', 'guest'])('does not serve PMCM finance payloads to %s actors', async (actorRole) => {
    const eventReadModelsService = {
      billing: vi.fn(async (actor) => {
        if (actor.role === 'supplier' || actor.role === 'guest') {
          throw new ForbiddenException('Only PMCM or client actors can read billing');
        }
        return { events: [], billingSources: [], billingStatements: [], paymentMilestones: [], paymentRecords: [] };
      }),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input: any, verified: any) => ({ role: verified.actorRole, name: verified.actorName })),
    };
    const controller = new OpsBillingController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
    );
    const verifiedActor = {
      id: `user_${actorRole}`,
      actorId: `user_${actorRole}`,
      role: actorRole,
      actorRole,
      email: `${actorRole}@example.test`,
      actorEmail: `${actorRole}@example.test`,
      name: actorRole,
      actorName: actorRole,
      expiresAt: '2026-07-03T12:00:00.000Z',
    };

    await expect(controller.list(verifiedActor as any)).rejects.toThrow(ForbiddenException);
    expect(eventReadModelsService.billing).toHaveBeenCalledWith(
      { role: actorRole, name: actorRole },
      expect.objectContaining({
        mapBillingSource: expect.any(Function),
        mapBillingStatement: expect.any(Function),
        mapPaymentMilestone: expect.any(Function),
        mapPaymentRecord: expect.any(Function),
      }),
    );
  });
});
