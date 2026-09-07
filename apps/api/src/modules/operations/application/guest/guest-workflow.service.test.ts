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

  it.each([
    ['closed', 'Walk-in registration is closed for this event'],
    ['threshold-exceeded', 'Walk-in registration threshold has been reached for this event'],
  ])('enforces %s walk-in policy', async (mode, message) => {
    const { service, state } = createGuestWorkflowFixture();
    if (mode === 'threshold-exceeded') {
      (state.events[0] as any).walkInPolicy = 'threshold';
      (state.events[0] as any).walkInThreshold = 1;
    } else {
      (state.events[0] as any).walkInPolicy = 'closed';
    }
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Walk In Guest', walkIn: true, privacyConsentAccepted: true,
    })).rejects.toThrow(message);
  });

  it('permits open and available threshold walk-ins', async () => {
    const { service, state } = createGuestWorkflowFixture();
    (state.events[0] as any).walkInPolicy = 'open';
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Open Walk In', walkIn: true, privacyConsentAccepted: true,
    })).resolves.toMatchObject({ guestName: 'Open Walk In', walkIn: true });
    (state.events[0] as any).walkInPolicy = 'threshold';
    (state.events[0] as any).walkInThreshold = 4;
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Threshold Walk In', walkIn: true, privacyConsentAccepted: true,
    })).resolves.toMatchObject({ guestName: 'Threshold Walk In', walkIn: true });
  });

  it('deduplicates roster check-in by roster identity when names repeat', async () => {
    const roster = [
      { id: 'gre_one', eventId: 'evt_sample', guestName: 'Maria Santos', eligibility: 'eligible', verificationStatus: 'pending', withdrawnAt: null, checkedInAt: null },
      { id: 'gre_two', eventId: 'evt_sample', guestName: 'Maria Santos', eligibility: 'eligible', verificationStatus: 'pending', withdrawnAt: null, checkedInAt: null },
    ];
    const checkIns: any[] = [];
    const tx = {
      $queryRaw: vi.fn(),
      opsEvent: { findFirst: vi.fn(async () => ({ id: 'evt_sample', archived: false })) },
      opsGuestRosterEntry: {
        findFirst: vi.fn(async ({ where }: any) => roster.find((entry) => entry.id === where.id && entry.eventId === where.eventId && entry.withdrawnAt === null && entry.eligibility === 'eligible') ?? null),
        update: vi.fn(async ({ where, data }: any) => Object.assign(roster.find((entry) => entry.id === where.id)!, data)),
      },
      opsGuestCheckIn: {
        findFirst: vi.fn(async ({ where }: any) => checkIns.find((checkIn) => checkIn.eventId === where.eventId && checkIn.rosterEntryId === where.rosterEntryId && checkIn.status === where.status) ?? null),
        create: vi.fn(async ({ data }: any) => { const checkIn = { ...data, checkedInAt: new Date('2026-06-18T09:00:00.000Z') }; checkIns.push(checkIn); return checkIn; }),
      },
    };
    const prisma = { $transaction: async (work: (context: typeof tx) => Promise<unknown>) => work(tx) };
    const service = new GuestWorkflowService(prisma as any, { write: vi.fn() } as any, new WorkflowCommandService(), new DocumentVaultService());

    const first = await service.checkInRosterEntry('evt_sample', 'gre_one', { name: 'Registration', role: 'coordinator' });
    const second = await service.checkInRosterEntry('evt_sample', 'gre_two', { name: 'Registration', role: 'coordinator' });

    expect([first.rosterEntryId, second.rosterEntryId]).toEqual(['gre_one', 'gre_two']);
    expect(checkIns).toHaveLength(2);
    expect(roster.map((entry) => entry.checkedInAt)).toEqual([expect.any(Date), expect.any(Date)]);
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
