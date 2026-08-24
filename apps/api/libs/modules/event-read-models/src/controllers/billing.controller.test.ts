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

  it('serves billing through EventReadModelsService with read-model and finance mappers', async () => {
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
        billingSources: [mappers.mapBillingSource({ id: 'bsrc_1' })],
        billingStatements: [mappers.mapBillingStatement({ id: 'bill_1' })],
        paymentMilestones: [mappers.mapPaymentMilestone({ id: 'pay_1' }, [{ id: 'prec_1' }])],
        paymentRecords: [mappers.mapPaymentRecord({ id: 'prec_1' })],
      })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input: any, verified: any) => ({
        role: verified.actorRole,
        clientName: verified.actorRole === 'client' ? verified.actorName : undefined,
        name: verified.actorName,
      })),
    };
    const billingOperationsService = {
      mapBillingSource: vi.fn((source) => ({ kind: 'source', id: source.id })),
      mapBillingStatement: vi.fn((statement) => ({ kind: 'statement', id: statement.id })),
      mapPaymentMilestone: vi.fn((payment, history) => ({ kind: 'milestone', id: payment.id, history })),
      mapPaymentRecord: vi.fn((record) => ({ kind: 'record', id: record.id })),
    };
    const controller = new OpsBillingController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
      billingOperationsService as any,
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
    expect(result.billingSources).toEqual([{ kind: 'source', id: 'bsrc_1' }]);
    expect(result.billingStatements).toEqual([{ kind: 'statement', id: 'bill_1' }]);
    expect(result.paymentMilestones).toEqual([{ kind: 'milestone', id: 'pay_1', history: [{ id: 'prec_1' }] }]);
    expect(result.paymentRecords).toEqual([{ kind: 'record', id: 'prec_1' }]);
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
    const billingOperationsService = {
      mapBillingSource: vi.fn(),
      mapBillingStatement: vi.fn(),
      mapPaymentMilestone: vi.fn(),
      mapPaymentRecord: vi.fn(),
    };
    const controller = new OpsBillingController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
      billingOperationsService as any,
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
