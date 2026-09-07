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
        actualEndedAt: new Date('2026-09-07T12:00:00.000Z'),
        actualEndedBy: 'user_pmcm',
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
      findMany: vi.fn(async ({ where }: any = {}) => state.events.filter((event) => where?.archived === undefined || event.archived === where.archived)),
      findUnique: vi.fn(async ({ where }: any) => state.events.find((event) => event.id === where.id) ?? null),
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
      findFirst: vi.fn(async ({ where }: any) => state.guestFeedback.find((item) => item.id === where.id && item.eventId === where.eventId) ?? null),
      update: vi.fn(async ({ where, data }: any) => {
        const row = state.guestFeedback.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const auditWriter = { write: vi.fn() };
  const service = new GuestWorkflowService(
    prisma as any,
    auditWriter as any,
    new WorkflowCommandService(),
    new DocumentVaultService(),
  );

  return { service, state, prisma, auditWriter };
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

  it('does not allow archived events to resolve ordinary guest check-in access', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.events[0].archived = true;
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Archived Guest', privacyConsentAccepted: true,
    })).rejects.toThrow('Guest event code was not found');
  });

  it('records guest check-ins and moderated feedback through command methods', async () => {
    const { service, auditWriter } = createGuestWorkflowFixture();

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
    expect(auditWriter.write).toHaveBeenCalledTimes(2);
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

  it('enforces the actual-end anchored seven-day window with distinct reasons', async () => {
    vi.useFakeTimers();
    const { service, state } = createGuestWorkflowFixture();
    vi.setSystemTime(new Date('2026-09-07T11:59:59.000Z'));
    await expect(service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Before', rating: 5, privacyConsentAccepted: true })).rejects.toThrow('opens after the event has actually ended');
    vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'));
    await expect(service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'At deadline', rating: 5, privacyConsentAccepted: true })).resolves.toMatchObject({ guestName: 'At deadline' });
    vi.setSystemTime(new Date('2026-09-14T12:00:00.001Z'));
    await expect(service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'After', rating: 5, privacyConsentAccepted: true })).rejects.toThrow('seven-day guest feedback window has closed');
    (state.events[0] as any).actualEndedAt = null;
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    await expect(service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Unknown end', rating: 5, privacyConsentAccepted: true })).rejects.toThrow('actual event end has not been recorded');
    vi.useRealTimers();
  });

  it('keeps archived feedback open while check-in remains denied and records moderation decisions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    const { service, state, auditWriter } = createGuestWorkflowFixture();
    state.events[0].archived = true;
    const feedback = await service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Archived Guest', rating: 4, privacyConsentAccepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', { guestName: 'Archived Guest', privacyConsentAccepted: true })).rejects.toThrow('Guest event code was not found');
    const updated = await service.moderateFeedback('evt_sample', feedback.id, { action: 'reject', reason: 'Contains private details' }, { id: 'pmcm-1', name: 'Maxine', role: 'pmcm-admin' });
    expect(updated).toMatchObject({ moderationStatus: 'rejected', moderationReason: 'Contains private details', moderatedById: 'pmcm-1', moderatedBy: 'Maxine' });
    expect(auditWriter.write).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('withdraws consent during the open window and prevents publishable consent assumptions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    const { service, state } = createGuestWorkflowFixture();
    const feedback = await service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Consent Guest', rating: 5, privacyConsentAccepted: true, marketingConsentAccepted: true, privacyNoticeVersion: '2026-09-01' });
    const withdrawn = await service.withdrawFeedbackConsentByAccessCode('AYALA-TECH-MPLE', feedback.id, { withdrawPrivacyConsent: true, withdrawMarketingConsent: true });
    expect(withdrawn).toMatchObject({ privacyConsentAccepted: false, marketingConsentAccepted: false });
    expect((withdrawn as any).privacyConsentWithdrawnAt).toBeInstanceOf(Date);
    expect(state.guestFeedback[0].privacyNoticeVersion).toBe('2026-09-01');
    vi.useRealTimers();
  });
});
