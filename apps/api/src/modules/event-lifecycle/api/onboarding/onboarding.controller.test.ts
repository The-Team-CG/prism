import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsOnboardingController } from './onboarding.controller';
const verifiedActor: Parameters<OpsOnboardingController['list']>[0] = { id: 'u1', actorId: 'u1', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'pmcm@test', actorEmail: 'pmcm@test', name: 'PMCM', actorName: 'PMCM', expiresAt: '2099-01-01' };

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsOnboardingController', () => {
  it('keeps the public onboarding route base stable under inquiry-onboarding ownership', () => {
    expect(controllerPath(OpsOnboardingController)).toBe('onboarding');
  });

  it('serves onboarding reads through InquiryWorkflowService with inquiry-owned mappers', async () => {
    const inquiriesService = {};
    const inquiryWorkflowService = {
      listOnboarding: vi.fn(async (_actor, context) => ({
        inquiries: [context.mapInquiry(inquiryRow())],
        events: [context.mapEvent(eventRow())],
        documents: [context.mapDocument(documentRow())],
      })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((input) => ({ role: input?.actorRole ?? 'pmcm-admin', name: 'PMCM Admin' })),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsOnboardingController(
      inquiriesService as any,
      inquiryWorkflowService as any,
      eventAccessPolicyService as any,
    );

    const result = await controller.list(verifiedActor);

    expect(result.inquiries[0]).toMatchObject({ id: 'inq_sample', eventDate: '2026-07-10' });
    expect(result.events[0]).toMatchObject({
      id: 'evt_sample',
      eventDate: '2026-07-10',
      guestAccessCode: 'AYALA-SUMMIT-MPLE',
    });
    expect(result.documents[0]).toMatchObject({ id: 'doc_sample', uploadedAt: '2026-06-20T09:00:00.000Z' });
    expect(inquiryWorkflowService.listOnboarding).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        inquiriesService,
        allowedAdminRoles: ['pmcm-admin', 'system'],
        mapInquiry: expect.any(Function),
        mapDocument: expect.any(Function),
        mapEvent: expect.any(Function),
      }),
      verifiedActor,
    );
  });
});

function inquiryRow() {
  return {
    id: 'inq_sample',
    clientName: 'Ana Reyes',
    companyName: null,
    email: 'ana@example.com',
    eventName: 'Ayala Summit',
    eventType: 'conference',
    eventDate: new Date('2026-07-10T00:00:00.000Z'),
    clientType: 'Corporate',
    source: 'Website',
    message: 'Need planning support',
    status: 'accepted',
    declineReason: null,
    acceptedAt: null,
    pendingAt: null,
    declinedAt: null,
    conformeSentAt: null,
    conformeSignedAt: null,
    portalActivatedAt: null,
    followUpIntervalDays: 3,
    lastConformeReminderAt: null,
    portalInvitationStatus: 'not_sent',
    portalInvitationSentAt: null,
    portalInvitationOpenedAt: null,
    portalInvitationExpiresAt: null,
    createdAt: new Date('2026-06-20T08:00:00.000Z'),
  };
}

function eventRow() {
  return {
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
  };
}

function documentRow() {
  return {
    id: 'doc_sample',
    eventId: 'evt_sample',
    type: 'signed_conforme',
    fileName: 'signed.pdf',
    status: 'approved',
    uploadedAt: new Date('2026-06-20T09:00:00.000Z'),
  };
}
