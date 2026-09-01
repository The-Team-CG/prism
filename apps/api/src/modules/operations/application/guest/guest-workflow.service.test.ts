import { describe, expect, it, vi } from 'vitest';
import { DocumentVaultService } from '@prism/contexts/event-lifecycle';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import { GuestWorkflowService } from './guest-workflow.service';

function createGuestWorkflowFixture() {
  const state = {
    events: [
      {
        id: 'evt_sample',
        inquiryId: 'inq_sample',
        eventName: 'Ayala Tech Summit',
        clientName: 'Ana Reyes',
        eventDate: new Date('2026-06-18T00:00:00.000Z'),
        status: 'event_day',
        clientPortalStatus: 'unlocked',
        readiness: 'Registration open',
        archived: false,
        floorPlanStatus: 'approved',
        floorPlanId: 'draft_active',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        floorPlanDrafts: [{ id: 'draft_active', floorPlanId: 'draft_active', isActive: true }],
      },
    ],
    guestCheckIns: [
      {
        id: 'gci_existing',
        eventId: 'evt_sample',
        guestName: 'Existing Guest',
        checkInMode: 'name_search',
        status: 'checked_in',
        walkIn: false,
        verificationStatus: 'verified',
        privacyConsentAccepted: true,
        privacyNoticeVersion: '2026-05-01',
        marketingConsentAccepted: false,
        checkedInAt: new Date('2026-06-18T08:00:00.000Z'),
      },
    ],
    guestFeedback: [] as any[],
  };

  const prisma = {
    opsEvent: {
      findMany: vi.fn(async () => state.events),
    },
    opsGuestCheckIn: {
      count: vi.fn(async ({ where }: any = {}) =>
        state.guestCheckIns.filter((item) => !where?.eventId || item.eventId === where.eventId).length,
      ),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const eventIds = where?.eventId?.in as string[] | undefined;
        return state.guestCheckIns.filter((item) =>
          eventIds ? eventIds.includes(item.eventId) : !where?.eventId || item.eventId === where.eventId,
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, checkedInAt: new Date('2026-06-18T09:00:00.000Z') };
        state.guestCheckIns.push(row);
        return row;
      }),
    },
    opsGuestFeedback: {
      findMany: vi.fn(async ({ where }: any = {}) => {
        const eventIds = where?.eventId?.in as string[] | undefined;
        return state.guestFeedback.filter((item) =>
          eventIds ? eventIds.includes(item.eventId) : !where?.eventId || item.eventId === where.eventId,
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, submittedAt: new Date('2026-06-18T10:00:00.000Z') };
        state.guestFeedback.push(row);
        return row;
      }),
    },
  };
  const auditService = { audit: vi.fn() };
  const service = new GuestWorkflowService(
    prisma as any,
    auditService as any,
    new WorkflowCommandService(),
    new DocumentVaultService(),
  );

  return { service, state, prisma, auditService };
}

describe('GuestWorkflowService', () => {
  it('resolves a guest event and returns attendance counts by access code', async () => {
    const { service } = createGuestWorkflowFixture();

    await expect(service.getEventByAccessCode('AYALA-TECH-MPLE')).resolves.toMatchObject({
      id: 'evt_sample',
      eventName: 'Ayala Tech Summit',
    });
    await expect(service.countCheckInsForEvent('evt_sample')).resolves.toBe(1);
  });

  it('requires privacy consent before guest check-in and feedback writes', async () => {
    const { service } = createGuestWorkflowFixture();

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', { guestName: 'Sofia Lim' })).rejects.toThrow(
      'Privacy consent is required before guest check-in',
    );
    await expect(
      service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Sofia Lim', rating: 5 }),
    ).rejects.toThrow('Privacy consent is required before guest feedback submission');
  });

  it('records guest check-ins and moderated feedback through command methods', async () => {
    const { service, auditService } = createGuestWorkflowFixture();

    const checkIn = await service.checkInByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      privacyConsentAccepted: true,
    });
    const feedback = await service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      rating: 5,
      comment: 'Smooth registration.',
      privacyConsentAccepted: true,
    });

    expect(checkIn).toMatchObject({ eventId: 'evt_sample', guestName: 'Sofia Lim', status: 'checked_in' });
    expect(feedback).toMatchObject({ eventId: 'evt_sample', guestName: 'Sofia Lim', moderationStatus: 'pending_review' });
    expect(auditService.audit).toHaveBeenCalledTimes(2);
  });

  it('maps guest event, check-in, and feedback payloads without PMCM-only fields', async () => {
    const { service, state } = createGuestWorkflowFixture();
    const feedback = await service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      rating: 5,
      comment: 'Smooth registration.',
      privacyConsentAccepted: true,
    });

    expect(service.mapGuestEvent(state.events[0] as any, 1)).toEqual(
      expect.objectContaining({
        id: 'evt_sample',
        eventName: 'Ayala Tech Summit',
        guestAccessCode: 'AYALA-TECH-MPLE',
        attendanceCount: 1,
      }),
    );
    expect(service.mapGuestCheckIn(state.guestCheckIns[0] as any)).toMatchObject({ guestName: 'Existing Guest' });
    expect(service.mapGuestFeedback(feedback)).toMatchObject({ guestName: 'Sofia Lim', moderationStatus: 'pending_review' });
    const guestEventPayload = service.mapGuestEvent(state.events[0] as any, 1);
    const guestEventJson = JSON.stringify(guestEventPayload);
    expect(guestEventPayload).not.toHaveProperty('clientPortalStatus');
    expect(guestEventPayload).not.toHaveProperty('status');
    expect(guestEventPayload).not.toHaveProperty('archived');
    expect(guestEventPayload).not.toHaveProperty('floorPlanId');
    expect(guestEventPayload).not.toHaveProperty('floorPlanDrafts');
    expect(guestEventJson).not.toContain('budgetRange');
    expect(guestEventJson).not.toContain('serviceRequirements');
    expect(guestEventJson).not.toContain('privateNotes');
  });
});
