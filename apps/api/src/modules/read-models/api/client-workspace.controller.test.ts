import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsClientController } from './client-workspace.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsClientController', () => {
  it('keeps the public client route base stable under event-read-models ownership', () => {
    expect(controllerPath(OpsClientController)).toBe('client');
  });

  it('serves client workspace and action center through EventReadModelsService', async () => {
    const eventReadModelsService = {
      clientWorkspace: vi.fn(async (_actor, mappers) => ({
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
            floorPlanStatus: 'submitted',
            floorPlanId: 'plan_active',
            floorPlanDrafts: [],
          }),
        ],
        documents: [
          mappers.mapDocument({
            id: 'doc_sample',
            eventId: 'evt_sample',
            type: 'signed_conforme',
            fileName: 'signed.pdf',
            status: 'approved',
            uploadedAt: new Date('2026-06-20T09:00:00.000Z'),
          }),
        ],
        briefings: [
          mappers.mapBriefing({
            eventId: 'evt_sample',
            venue: 'BGC Hall',
            guestCount: 120,
            budgetRange: '500k-700k',
            serviceRequirements: ['Program'],
            notes: 'VIP ingress',
            submittedAt: new Date('2026-06-20T09:30:00.000Z'),
          }),
        ],
        billingStatements: [mappers.mapBillingStatement({ id: 'bill_1' })],
        paymentMilestones: [mappers.mapPaymentMilestone({ id: 'pay_1' }, [])],
        floorPlanDrafts: [
          mappers.mapFloorPlanDraft({
            id: 'fpd_1',
            eventId: 'evt_sample',
            floorPlanId: 'plan_active',
            name: 'Client preference',
            status: 'submitted',
            isActive: false,
            sourceType: 'client_preference',
            createdByRole: 'client',
            clientPreference: { seatingStyle: 'rounds' },
            submittedAt: null,
            reviewedAt: null,
            approvedAt: null,
            createdAt: new Date('2026-06-20T10:00:00.000Z'),
            updatedAt: new Date('2026-06-20T10:00:00.000Z'),
          }),
        ],
        auditLogs: [
          mappers.mapAuditLog({
            id: 'aud_1',
            eventId: null,
            actor: 'PMCM Admin',
            actorRole: 'pmcm-admin',
            actorEmail: null,
            action: 'Viewed workspace',
            actionType: 'read',
            category: 'access',
            affectedType: null,
            affectedId: null,
            affectedLabel: null,
            metadata: {},
            ipAddress: '127.0.0.1',
            device: 'test',
            severity: 'info',
            immutableHash: 'hash',
            previousHash: null,
            createdAt: new Date('2026-06-20T10:00:00.000Z'),
          }),
        ],
      })),
      clientActionCenter: vi.fn(async () => ({ items: [{ id: 'briefing:evt_sample' }] })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input: any, verified: any) => ({
        role: verified.actorRole,
        clientName: verified.actorRole === 'client' ? verified.actorName : undefined,
        name: verified.actorName,
      })),
    };
    const billingOperationsService = {
      mapBillingStatement: vi.fn((statement) => ({ kind: 'statement', id: statement.id })),
      mapPaymentMilestone: vi.fn((payment, history) => ({ kind: 'milestone', id: payment.id, history })),
    };
    const controller = new OpsClientController(
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
    const workspace = await controller.getClientWorkspace(verifiedActor as any);
    const actionCenter = await controller.actionCenter(verifiedActor as any);

    expect(workspace.events[0]).toMatchObject({
      id: 'evt_sample',
      eventDate: '2026-07-10',
      guestAccessCode: 'AYALA-SUMMIT-MPLE',
    });
    expect(workspace.documents[0]).toMatchObject({ id: 'doc_sample', uploadedAt: '2026-06-20T09:00:00.000Z' });
    expect(workspace.briefings[0]).toMatchObject({ eventId: 'evt_sample', serviceRequirements: ['Program'] });
    expect(workspace.billingStatements).toEqual([{ kind: 'statement', id: 'bill_1' }]);
    expect(workspace.paymentMilestones).toEqual([{ kind: 'milestone', id: 'pay_1', history: [] }]);
    expect(workspace.floorPlanDrafts[0]).toMatchObject({ id: 'fpd_1', status: 'submitted' });
    expect(workspace.auditLogs).toMatchObject([
      { id: 'aud_1', actor: 'PMCM Admin', action: 'Viewed workspace', createdAt: '2026-06-20T10:00:00.000Z' },
    ]);
    expect(actionCenter).toEqual({ items: [{ id: 'briefing:evt_sample' }] });
    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(eventReadModelsService.clientWorkspace).toHaveBeenCalledWith(
      { role: 'client', clientName: 'Ana Reyes', name: 'Ana Reyes' },
      expect.objectContaining({
        mapEvent: expect.any(Function),
        mapDocument: expect.any(Function),
        mapBriefing: expect.any(Function),
        mapBillingStatement: expect.any(Function),
        mapPaymentMilestone: expect.any(Function),
        mapFloorPlanDraft: expect.any(Function),
        mapAuditLog: expect.any(Function),
      }),
    );
    expect(eventReadModelsService.clientActionCenter).toHaveBeenCalledWith({
      role: 'client',
      clientName: 'Ana Reyes',
      name: 'Ana Reyes',
    });
  });
});
