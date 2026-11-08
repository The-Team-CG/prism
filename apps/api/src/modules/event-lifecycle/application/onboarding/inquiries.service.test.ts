import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { InquiriesService, inquiryDeclinedMessage } from './inquiries.service';
import { mapInquirySummary } from './inquiry.mappers';

import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';
function inquiry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inq_existing',
    clientName: 'Ana Reyes',
    companyName: 'Ayala Corp',
    organizationKey: 'ayalacorp',
    email: 'ana@ayala.test',
    normalizedEmail: 'ana@ayala.test',
    mergedInto: null,
    eventName: 'Ayala Summit',
    eventType: 'Corporate',
    eventDate: new Date('2026-06-18T00:00:00.000Z'),
    clientType: 'Corporate',
    source: 'Website',
    referralDetails: '',
    loggedByRole: null,
    loggedByName: null,
    duplicateOfInquiryId: null,
    previousDeclinedInquiryId: null,
    previousDeclineReason: null,
    message: 'Planning inquiry',
    privacyConsentAccepted: true,
    privacyNoticeVersion: '2026-05-01',
    marketingConsentAccepted: false,
    status: 'new',
    acceptedAt: null,
    pendingAt: null,
    declinedAt: null,
    declineReason: null,
    conformeSentAt: null,
    conformeSignedAt: null,
    portalActivatedAt: null,
    portalInvitationStatus: 'not_sent',
    portalInvitationSentAt: null,
    portalInvitationOpenedAt: null,
    portalInvitationExpiresAt: null,
    followUpIntervalDays: 3,
    lastConformeReminderAt: null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    ...overrides,
  };
}

const invitedOutcome = { outcome: 'invited', sentAt: '2026-10-25T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z' };

function createService(
  existing = [inquiry()],
  accountProvisioning: { provision: (input: never) => Promise<unknown> } = { provision: vi.fn(async (_input: unknown) => invitedOutcome) },
  pastEvents: Array<{ eventName: string; eventDate: Date }> = [],
) {
  const nameChanges: Array<Record<string, unknown>> = [];
  const records: any[] = [...existing];
  const events: any[] = [];
  const documents: any[] = [];
  const notifications: any[] = [];
  const audits: any[] = [];
  const merges: any[] = [];
  const transaction = {
    $queryRaw: vi.fn(async () => []),
    opsInquiryCompanyNameChange: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, changedAt: new Date('2026-05-04T00:00:00.000Z') }; nameChanges.push(row); return row; }) },
    opsInquiryMerge: {
      create: vi.fn(async ({ data }) => {
        const source = records.find((item) => item.id === data.mergedInquiryId);
        const merge = { ...data, id: data.id, createdAt: new Date('2026-05-03T00:00:00.000Z') };
        if (source) source.mergedInto = merge;
        merges.push(merge);
        return merge;
      }),
    },
    opsEvent: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }) => { const row = { ...data }; events.push(row); return row; }),
      update: vi.fn(async ({ where, data }) => { const row = events.find((item) => item.id === where.id); Object.assign(row, data); return row; }),
    },
    opsPostEventDocument: { createMany: vi.fn(async () => ({ count: 2 })) },
    opsStoredObject: {
      findUnique: vi.fn(async ({ where }) => ({ id: where.id, eventId: events[0]?.id, usage: 'signed_conforme', lifecycleState: 'stored' })),
    },
    opsDocument: {
      create: vi.fn(async ({ data }) => { const row = { ...data }; documents.push(row); return row; }),
    },
    opsInquiry: {
      findUnique: vi.fn(async ({ where }) => records.find((item) => item.id === where.id) ?? null),
      findUniqueOrThrow: vi.fn(async ({ where }) => {
        const row = records.find((item) => item.id === where.id);
        if (!row) throw new Error('Inquiry not found');
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = records.find((item) => item.id === where.id);
        const dateMatches = (left: unknown, right: unknown) =>
          left === null || right === null ? left === right : left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
        if (
          !row || row.status !== where.status || row.conformeSignedAt !== where.conformeSignedAt ||
          !dateMatches(row.conformeSentAt, where.conformeSentAt) ||
          !dateMatches(row.lastConformeReminderAt, where.lastConformeReminderAt)
        ) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }) => {
        const index = records.findIndex((item) => item.id === where.id);
        records[index] = { ...records[index], ...data };
        return records[index];
      }),
    },
  };
  const prisma = {
    opsInquiry: {
      findMany: vi.fn(async () => records),
      create: vi.fn(async ({ data }) => {
        const row = { ...inquiry(), ...data, createdAt: new Date('2026-05-02T00:00:00.000Z') };
        records.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }) => records.find((item) => item.id === where.id) ?? null),
      update: vi.fn(async ({ where, data }) => {
        const index = records.findIndex((item) => item.id === where.id);
        records[index] = { ...records[index], ...data };
        return records[index];
      }),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    opsEvent: { findFirst: vi.fn(async () => null), findMany: vi.fn(async () => pastEvents) },
    opsBillingSource: { create: vi.fn(), count: vi.fn() },
    opsBillingStatement: { create: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
  };
  const auditWriter = { write: vi.fn(async (...entry: unknown[]) => audits.push(entry)) };
  const notificationOutboxWriter = { write: vi.fn(async (...entry: unknown[]) => notifications.push(entry)) };
  const service = new InquiriesService(
    prisma as any,
    auditWriter as any,
    notificationOutboxWriter as any,
    new WorkflowCommandService(),
    accountProvisioning as any,
  );
  return { service, records, notifications, audits, prisma, merges, accountProvisioning, nameChanges, transaction };
}

const pmcmActor = {
  id: 'pmcm_merge', role: OpsUserRole.PmcmAdmin, name: 'M. Reyes', email: 'm.reyes@pmcm.test',
  explicit: true, verified: true,
} satisfies ResolvedEventOpsActor;

const declineLead = 'About your inquiry for Ayala Summit. Thank you for thinking of PMCM. We can\'t take on Ayala Summit this time.';
const declineClose = 'We would welcome the chance to work with you on future events, so please reach out anytime.';
const declineGenericEmail = `${declineLead} ${declineClose}`;
const declineDateEmail = `${declineLead} We're not available on your requested date. ${declineClose}`;
const declineScopeEmail = `${declineLead} The event is outside the services we currently offer. ${declineClose}`;

describe('inquiryDeclinedMessage', () => {
  it.each([
    { declineReason: 'Date Unavailable', expected: declineDateEmail },
    { declineReason: 'Outside Service Scope', expected: declineScopeEmail },
    { declineReason: 'Budget Too Low', expected: declineGenericEmail },
    { declineReason: 'Prior Issue', expected: declineGenericEmail },
    { declineReason: 'Other', expected: declineGenericEmail },
    { declineReason: undefined, expected: declineGenericEmail },
  ])('writes the client copy for reason $declineReason', ({ declineReason, expected }) => {
    expect(inquiryDeclinedMessage('Ayala Summit', declineReason)).toBe(expected);
  });
});

describe('InquiriesService', () => {
  it('logs a PMCM company name change with its reason and moves the inquiry to the new organization', async () => {
    const { service, records, nameChanges } = createService([inquiry({ id: 'inq_1', companyName: 'Acme Corp' })]);
    (service as any).prisma.$transaction = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({ ...(service as any).prisma, opsInquiryCompanyNameChange: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, changedAt: new Date() }; nameChanges.push(row); return row; }) } }));
    const change = await service.updateCompanyName('inq_1', { companyName: 'Acme Holdings', reason: 'Rebranded' }, pmcmActor);
    expect(change).toMatchObject({ fromName: 'Acme Corp', toName: 'Acme Holdings', reason: 'Rebranded', changedBy: 'M. Reyes' });
    expect(records[0]).toMatchObject({ companyName: 'Acme Holdings', organizationKey: 'acmeholdings' });
    await expect(service.updateCompanyName('inq_1', { companyName: 'Acme Holdings', reason: 'Again' }, pmcmActor)).rejects.toThrow('unchanged');
    await expect(service.updateCompanyName('inq_1', { companyName: 'X', reason: 'Y' }, { ...pmcmActor, role: OpsUserRole.Client })).rejects.toThrow('Only PMCM');
  });

  it('tells PMCM when a client returns after more than a year without an event, and not for a recent client', async () => {
    const base = { privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION, clientName: 'Ana', email: 'ana@acme.test', eventName: 'Gala 2027', eventDate: '2027-07-02', clientType: 'Corporate', message: 'Back again' };
    const dormant = createService([], undefined, [{ eventName: 'Gala 2024', eventDate: new Date('2024-06-01T00:00:00.000Z') }]);
    await dormant.service.createInquiry(base);
    expect(dormant.notifications.some(([entry]) => String((entry as { message: string }).message).startsWith('Returning client Ana: 1 past event, last "Gala 2024"'))).toBe(true);
    const recent = createService([], undefined, [{ eventName: 'Gala', eventDate: new Date(Date.now() - 30 * 86_400_000) }]);
    await recent.service.createInquiry(base);
    expect(recent.notifications.some(([entry]) => String((entry as { message: string }).message).startsWith('Returning client'))).toBe(false);
  });

  it('requires privacy consent for public inquiry creation', async () => {
    const { service } = createService([]);

    await expect(
      service.createInquiry({
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
        clientName: 'Mia Cruz',
        email: 'mia@example.test',
        eventName: 'Privacy Event',
        eventDate: '2026-07-01',
        clientType: 'Corporate',
        message: 'Planning inquiry',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the optional room set-up preference as typed, and leaves it empty when the client skips it', async () => {
    const { service } = createService([]);
    const base = {
      privacyConsentAccepted: true,
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      clientName: 'Setup Client',
      email: 'setup@example.test',
      eventName: 'Setup Night',
      eventDate: '2026-07-02',
      clientType: 'Corporate',
      message: 'Planning inquiry',
    };

    const withPreference = await service.createInquiry({ ...base, seatingArrangement: 'Banquet rounds', stagePosition: 'Centre', setupNotes: 'Sponsor wall behind the stage' });
    expect(withPreference).toMatchObject({ seatingArrangement: 'Banquet rounds', stagePosition: 'Centre', setupNotes: 'Sponsor wall behind the stage' });

    const skipped = await service.createInquiry({ ...base, email: 'skip@example.test' });
    expect(skipped).toMatchObject({ seatingArrangement: null, stagePosition: null, setupNotes: null });
  });

  it('saves a basic on-behalf inquiry as Pending Full Details until the missing fields are filled in', async () => {
    const { service } = createService([]);
    const pmcm = { id: 'pmcm_1', role: OpsUserRole.PmcmAdmin, name: 'Marco', email: 'marco@pmcm.test', explicit: true, verified: true } satisfies ResolvedEventOpsActor;

    const basic = await service.logInquiryOnBehalf(
      { privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION, clientName: 'Walk In Client', email: 'walkin@example.test', eventName: 'Walk In Product Launch', eventDate: '2026-07-10' },
      pmcm,
    );
    expect(basic).toMatchObject({ clientType: '', source: '', message: '' });
    expect(mapInquirySummary(basic)).toMatchObject({ pendingFullDetails: true });

    const completed = { ...basic, clientType: 'Corporate', source: 'BNI Referral', message: 'Client gave details at PMCM office' };
    expect(mapInquirySummary(completed)).toMatchObject({ pendingFullDetails: false });
  });

  it('blocks non-PMCM actors from logging inquiries on behalf of clients', async () => {
    const { service } = createService([]);

    await expect(
      service.logInquiryOnBehalf(
        {
          privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
          clientName: 'Walk In Client',
          email: 'walkin@example.test',
          eventName: 'Walk In Product Launch',
          eventDate: '2026-07-10',
          clientType: 'Corporate',
          message: 'Client gave details at PMCM office',
        },
        { id: 'client_1', role: OpsUserRole.Client, name: 'Ana Reyes', explicit: true, verified: true },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects caller-supplied PMCM identity before creating an inquiry on behalf', async () => {
    const { service, prisma } = createService([]);
    const input = {
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      clientName: 'Walk In Client',
      email: 'walkin@example.test',
      eventName: 'Walk In Product Launch',
      eventDate: '2026-07-10',
      clientType: 'Corporate',
      message: 'Client gave details at PMCM office',
    };

    await expect(service.logInquiryOnBehalf(
      input,
      { id: 'spoofed_admin', role: OpsUserRole.PmcmAdmin, name: 'Spoofed Admin', explicit: true, verified: false },
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.opsInquiry.create).not.toHaveBeenCalled();

    await expect(service.logInquiryOnBehalf(input, undefined as unknown as ResolvedEventOpsActor))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.opsInquiry.create).not.toHaveBeenCalled();
  });

  it('persists the channel and real actor identity when logging an inquiry on behalf of a client', async () => {
    const { service, audits } = createService([]);

    const created = await service.logInquiryOnBehalf(
      {
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
        clientName: 'Walk In Client',
        email: 'walkin@example.test',
        eventName: 'Walk In Product Launch',
        eventDate: '2026-07-10',
        clientType: 'Corporate',
        source: 'BNI Referral',
        channel: 'Walk-In',
        message: 'Client gave details at PMCM office',
      },
      {
        id: 'pmcm_1',
        role: OpsUserRole.PmcmAdmin,
        name: 'Marco',
        email: 'marco@pmcm.test',
        explicit: true,
        verified: true,
      } satisfies ResolvedEventOpsActor,
    );

    expect((created as any).channel).toBe('Walk-In');
    expect((created as any).source).toBe('BNI Referral');
    expect((created as any).loggedByName).toBe('Marco');
    expect((created as any).loggedByRole).toBe(OpsUserRole.PmcmAdmin);
    expect(audits[0]?.[0]).toMatchObject({
      actor: 'Marco',
      actorRole: OpsUserRole.PmcmAdmin,
      actorEmail: 'marco@pmcm.test',
      metadata: { actorId: 'pmcm_1', source: 'BNI Referral' },
    });
  });

  it('links duplicate and previous declined inquiries by normalized email', async () => {
    const { service, audits } = createService([
      inquiry({ id: 'inq_same_window', eventDate: new Date('2026-07-01T00:00:00.000Z') }),
      inquiry({
        id: 'inq_declined',
        status: 'declined',
        declineReason: 'Date unavailable',
        declinedAt: new Date('2026-05-01T00:00:00.000Z'),
        eventDate: new Date('2026-04-01T00:00:00.000Z'),
      }),
    ]);

    const created = await service.createInquiry({
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      clientName: 'Ana Reyes',
      email: ' ANA@ayala.test ',
      eventName: 'Ayala Summit Follow-up',
      eventDate: '2026-07-08',
      clientType: 'Corporate',
      message: 'Second submission for same planning window',
      privacyConsentAccepted: true,
    });

    expect((created as any).normalizedEmail).toBe('ana@ayala.test');
    expect((created as any).duplicateOfInquiryId).toBe('inq_same_window');
    expect((created as any).previousDeclinedInquiryId).toBe('inq_declined');
    expect(audits[0]?.[0]).toMatchObject({ actor: 'System', actorRole: OpsUserRole.System });
  });

  it.each(['accepted', 'pending', 'declined'] as const)('records the verified actor for an inquiry %s transition', async (status) => {
    const { service, audits } = createService();
    const actor = {
      id: 'pmcm_2', role: OpsUserRole.PmcmAdmin, name: 'M. Reyes', email: 'm.reyes@pmcm.test',
      explicit: true, verified: true,
    } satisfies ResolvedEventOpsActor;

    await service.updateInquiryStatus('inq_existing', {
      status,
      ...(status === 'declined' ? { declineReason: 'Date conflict' } : {}),
    }, actor);

    const audit = audits.find(([input]) => (input as { actor?: string }).actor === 'M. Reyes')?.[0];
    expect(audit).toMatchObject({
      actor: 'M. Reyes',
      actorRole: OpsUserRole.PmcmAdmin,
      actorEmail: 'm.reyes@pmcm.test',
      metadata: { actorId: 'pmcm_2' },
    });
  });

  it.each([
    { label: 'without a reason', declineReason: undefined, auditAction: 'Declined inquiry for Ana Reyes with no reason given' },
    { label: 'with a reason', declineReason: 'Budget Too Low', auditAction: 'Declined inquiry for Ana Reyes: Budget Too Low' },
  ])('declines an inquiry $label and audits the outcome', async ({ declineReason, auditAction }) => {
    const { service, records, audits } = createService();

    await expect(service.updateInquiryStatus('inq_existing', { status: 'declined', declineReason }, pmcmActor))
      .resolves.toMatchObject({ status: 'declined' });

    expect(records[0]).toMatchObject({ status: 'declined', declineReason: declineReason ?? null });
    expect(audits.map(([input]) => input)).toContainEqual(expect.objectContaining({ action: auditAction }));
  });

  describe('client decline email', () => {
    it.each([
      { declineReason: undefined, message: declineGenericEmail },
      { declineReason: 'Date Unavailable', message: declineDateEmail },
      { declineReason: 'Outside Service Scope', message: declineScopeEmail },
    ])('queues one decline email to the client with the disclosed copy for reason $declineReason', async ({ declineReason, message }) => {
      const { service, notifications } = createService();

      await service.updateInquiryStatus('inq_existing', { status: 'declined', declineReason }, pmcmActor);

      expect(notifications).toHaveLength(1);
      expect(notifications[0][0]).toMatchObject({
        recipient: 'ana@ayala.test',
        channel: 'email',
        message,
        idempotencyKey: 'inquiry-declined:inq_existing',
      });
    });

    it.each(['Budget Too Low', 'Prior Issue', 'Other'])('sends the generic copy and does not disclose the internal reason %s', async (declineReason) => {
      const { service, notifications } = createService();

      await service.updateInquiryStatus('inq_existing', { status: 'declined', declineReason }, pmcmActor);

      expect(notifications[0][0].message).toBe(declineGenericEmail);
    });

    it('sends nothing again when the same inquiry is declined a second time, even with a new reason', async () => {
      const { service, notifications, records } = createService();

      await service.updateInquiryStatus('inq_existing', { status: 'declined', declineReason: 'Other' }, pmcmActor);
      await expect(service.updateInquiryStatus('inq_existing', { status: 'declined', declineReason: 'Date Unavailable' }, pmcmActor))
        .resolves.toMatchObject({ status: 'declined' });

      expect(notifications).toHaveLength(1);
      expect(records[0]).toMatchObject({ status: 'declined' });
    });

    it('refuses to decline a merged inquiry and sends nothing to its client', async () => {
      const { service, notifications } = createService([inquiry({ mergedInto: { id: 'merge_1' } })]);

      await expect(service.updateInquiryStatus('inq_existing', { status: 'declined', declineReason: 'Date Unavailable' }, pmcmActor))
        .rejects.toBeInstanceOf(ConflictException);

      expect(notifications).toHaveLength(0);
    });
  });

  it('records the verified actor for manual conforme reminders', async () => {
    const { service, audits } = createService([inquiry({
      status: 'accepted',
      conformeSentAt: new Date('2026-05-01T00:00:00.000Z'),
    })]);
    const actor = {
      id: 'pmcm_3', role: OpsUserRole.PmcmAdmin, name: 'A. Santos', email: 'a.santos@pmcm.test',
      explicit: true, verified: true,
    } satisfies ResolvedEventOpsActor;

    await service.sendConformeReminder('inq_existing', actor);

    expect(audits[0]?.[0]).toMatchObject({
      actor: 'A. Santos',
      actorRole: OpsUserRole.PmcmAdmin,
      actorEmail: 'a.santos@pmcm.test',
      metadata: { actorId: 'pmcm_3' },
    });
  });

  it('does not fabricate an approved billing source when conforme is signed', async () => {
    const { service, prisma } = createService([inquiry({ status: 'accepted' })]);

    await service.uploadConforme(
      'inq_existing',
      { fileName: 'signed-conforme.pdf' },
      { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true },
    );

    expect(prisma.opsBillingSource.create).not.toHaveBeenCalled();
    expect(prisma.opsBillingStatement.create).not.toHaveBeenCalled();
  });

  it('rejects non-conforme document types before activating the portal', async () => {
    const { service, prisma } = createService([inquiry({ status: 'accepted' })]);

    await expect(service.uploadConforme(
      'inq_existing',
      { type: 'billing_statement', fileName: 'wrong.pdf' },
      { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true },
    )).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('uses the shared reminder-window claim so the scheduled sweep queues only once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T12:00:00.000Z'));
    try {
      const { service, notifications } = createService([inquiry({
        status: 'accepted',
        conformeSentAt: new Date('2026-09-15T12:00:00.000Z'),
      })]);

      await service.runConformeReminderSweep();
      expect(notifications).toHaveLength(2);
      expect(notifications[0][0]).toMatchObject({ channel: 'email', idempotencyKey: expect.stringContaining('conforme-follow-up:inq_existing:') });
      expect(notifications[1][0]).toMatchObject({ channel: 'viber', idempotencyKey: expect.stringContaining('conforme-follow-up:inq_existing:') });

      await service.runConformeReminderSweep();
      expect(notifications).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('derives organization and triage fields server-side so a public payload cannot set them', async () => {
    const { service, records } = createService([]);
    const spoofed = {
      privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
      clientName: 'Mia Cruz',
      companyName: 'Cruz Holdings',
      email: 'mia@example.test',
      eventName: 'Spoof Attempt',
      eventDate: '2026-07-01',
      clientType: 'Individual',
      message: 'Planning inquiry',
      privacyConsentAccepted: true,
      organizationKey: 'spoofed-org',
      mergedIntoInquiryId: 'inq_primary',
      duplicateOfInquiryId: 'inq_primary',
      highFit: true,
    };

    // A variable (not a literal) avoids excess-property checks; the service must still ignore the extra keys.
    const created = await service.createInquiry(spoofed);

    expect((created as any).organizationKey).toBe('cruzholdings');
    expect((created as any).mergedIntoInquiryId).toBeUndefined();
    expect(records[records.length - 1]).toMatchObject({ organizationKey: 'cruzholdings', duplicateOfInquiryId: null });
  });

  it('queues PMCM notifications for duplicate and deterministic high-fit inquiries only', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
    try {
      const { service, notifications } = createService([inquiry({ eventDate: new Date('2026-06-18T00:00:00.000Z') })]);

      // Same email within the 14-day window, corporate client with a named organization, event still ahead.
      await service.createInquiry({
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
        clientName: 'Ana Reyes', companyName: 'Ayala Corp', email: 'ana@ayala.test',
        eventName: 'Ayala Summit Follow-up', eventDate: '2026-07-01', clientType: 'Corporate',
        message: 'Second planning window', privacyConsentAccepted: true,
      });
      const pmcmMessages = notifications.filter(([input]) => input.recipient === 'pmcm-inquiry-desk');
      expect(pmcmMessages.map(([input]) => input.idempotencyKey).sort()).toEqual([
        expect.stringMatching(/^inquiry-triage:.+:duplicate$/),
        expect.stringMatching(/^inquiry-triage:.+:high-fit$/),
      ]);

      notifications.length = 0;
      await service.createInquiry({
        privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION,
        clientName: 'Walk Client', email: 'walk@example.test', eventName: 'Quiet Party',
        eventDate: '2026-07-20', clientType: 'Private', message: 'Small gathering', privacyConsentAccepted: true,
      });
      expect(notifications.filter(([input]) => input.recipient === 'pmcm-inquiry-desk')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('merges a same-organization inquiry into the primary, records history and audit, and blocks a repeat merge', async () => {
    const { service, records, merges, audits } = createService([
      inquiry({ id: 'inq_primary' }),
      inquiry({ id: 'inq_parallel', email: 'ben@ayala.test', normalizedEmail: 'ben@ayala.test', status: 'new' }),
    ]);

    const merge = await service.mergeInquiry('inq_primary', { sourceInquiryId: 'inq_parallel', reason: 'Same client company, second contact' }, pmcmActor);

    expect(merge).toMatchObject({
      primaryInquiryId: 'inq_primary',
      mergedInquiryId: 'inq_parallel',
      matchBasis: 'organization',
      actorRole: OpsUserRole.PmcmAdmin,
      actorName: 'M. Reyes',
    });
    expect(records.find((item) => item.id === 'inq_parallel')?.mergedInto).toBeTruthy();
    expect(audits.find(([input]) => (input as { affectedId?: string }).affectedId === 'inq_parallel')?.[0]).toMatchObject({
      actionType: 'update',
      metadata: { primaryInquiryId: 'inq_primary', matchBasis: 'organization' },
    });

    await expect(service.mergeInquiry('inq_primary', { sourceInquiryId: 'inq_parallel', reason: 'Again' }, pmcmActor))
      .rejects.toBeInstanceOf(ConflictException);
    expect(merges).toHaveLength(1);

    await expect(service.updateInquiryStatus('inq_parallel', { status: 'accepted' }, pmcmActor))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses to merge inquiries that share neither an organization nor an email', async () => {
    const { service, merges } = createService([
      inquiry({ id: 'inq_primary' }),
      inquiry({ id: 'inq_unrelated', companyName: 'Other Co', organizationKey: 'otherco', email: 'x@other.test', normalizedEmail: 'x@other.test' }),
    ]);

    await expect(service.mergeInquiry('inq_primary', { sourceInquiryId: 'inq_unrelated', reason: 'Guess' }, pmcmActor))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(merges).toHaveLength(0);
  });

  it('blocks non-PMCM actors from merging inquiries', async () => {
    const { service, merges } = createService([
      inquiry({ id: 'inq_primary' }),
      inquiry({ id: 'inq_parallel', email: 'ben@ayala.test', normalizedEmail: 'ben@ayala.test' }),
    ]);
    const clientActor = { id: 'client_1', role: OpsUserRole.Client, name: 'Ana Reyes', explicit: true, verified: true } satisfies ResolvedEventOpsActor;

    await expect(service.mergeInquiry('inq_primary', { sourceInquiryId: 'inq_parallel', reason: 'Client trying' }, clientActor))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(merges).toHaveLength(0);
  });
});

describe('client portal invitation after acceptance', () => {
  const invitedOutcome = { outcome: 'invited', sentAt: '2026-10-25T00:00:00.000Z', expiresAt: '2026-11-01T00:00:00.000Z' };
  const pmcmAccepter = { id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true, verified: true } as ResolvedEventOpsActor;
  const invitedPayload = { role: 'client', source: 'inquiry_acceptance', sourceId: 'inq_existing', actor: { id: 'usr_pmcm', name: 'PMCM Admin', role: 'pmcm-admin' } };

  it.each([
    ['a new login', invitedOutcome, { portalInvitationStatus: 'sent', portalInvitationSentAt: new Date(invitedOutcome.sentAt), portalInvitationExpiresAt: new Date(invitedOutcome.expiresAt) }],
    ['an account that already signs in', { outcome: 'existing_account' }, { portalInvitationStatus: 'opened', portalInvitationOpenedAt: expect.any(Date) }],
    ['a delivery failure', { outcome: 'delivery_failed' }, { portalInvitationStatus: 'not_sent', portalInvitationSentAt: null, portalInvitationExpiresAt: null }],
    ['an account not yet approved', { outcome: 'account_not_active' }, { portalInvitationStatus: 'not_sent', portalInvitationSentAt: null, portalInvitationExpiresAt: null }],
    ['a role conflict', { outcome: 'role_conflict' }, { portalInvitationStatus: 'not_sent', portalInvitationSentAt: null, portalInvitationExpiresAt: null }],
  ])('accepting an inquiry provisions the client once and records %s', async (_label, outcome, expected) => {
    const accountProvisioning = { provision: vi.fn(async (_input: unknown) => outcome) };
    const { service, records } = createService([inquiry({ status: 'pending' })], accountProvisioning);

    await service.updateInquiryStatus('inq_existing', { status: 'accepted' }, pmcmAccepter);

    expect(accountProvisioning.provision).toHaveBeenCalledOnce();
    expect(accountProvisioning.provision).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ana@ayala.test', name: 'Ana Reyes', organization: 'Ayala Corp', ...invitedPayload,
    }));
    expect(records[0]).toMatchObject(expected);
  });

  it('a repeat accept provisions nothing and announces nothing new', async () => {
    const { service, accountProvisioning, notifications, audits } = createService([inquiry({ status: 'pending' })]);

    await service.updateInquiryStatus('inq_existing', { status: 'accepted' }, pmcmAccepter);
    const notificationsAfterFirst = notifications.length;
    const auditsAfterFirst = audits.length;
    await expect(service.updateInquiryStatus('inq_existing', { status: 'accepted' }, pmcmAccepter)).resolves.toMatchObject({ status: 'accepted' });

    expect(accountProvisioning.provision).toHaveBeenCalledOnce();
    expect(notifications).toHaveLength(notificationsAfterFirst);
    expect(audits).toHaveLength(auditsAfterFirst);
  });

  it('keeps the acceptance and records not sent when provisioning throws after commit', async () => {
    const accountProvisioning = { provision: vi.fn(async (_input: unknown) => { throw new Error('mail transport offline'); }) };
    const { service, records, audits } = createService([inquiry({ status: 'pending' })], accountProvisioning);

    await expect(service.updateInquiryStatus('inq_existing', { status: 'accepted' }, pmcmAccepter)).resolves.toMatchObject({ status: 'accepted' });

    expect(records[0]).toMatchObject({ status: 'accepted', portalInvitationStatus: 'not_sent' });
    expect(audits.map(([entry]) => entry)).toContainEqual(expect.objectContaining({
      actor: 'PMCM Admin',
      action: 'Client portal invitation could not be issued after the inquiry was accepted',
    }));
  });

  it('allows a PMCM resend for an accepted inquiry whose conforme is not signed yet', async () => {
    const { service, accountProvisioning } = createService([inquiry({ status: 'accepted' })]);

    await expect(service.resendClientPortalInvitation('inq_existing', pmcmAccepter))
      .resolves.toMatchObject({ outcome: invitedOutcome, inquiry: { id: 'inq_existing', portalInvitationStatus: 'sent' } });

    expect(accountProvisioning.provision).toHaveBeenCalledWith(expect.objectContaining(invitedPayload));
  });

  it('refuses a resend for an inquiry that PMCM has not accepted, and sends nothing', async () => {
    const { service, accountProvisioning } = createService([inquiry({ status: 'pending' })]);

    await expect(service.resendClientPortalInvitation('inq_existing', pmcmAccepter)).rejects.toBeInstanceOf(ConflictException);

    expect(accountProvisioning.provision).not.toHaveBeenCalled();
  });

  it('does not send a client invitation when a stored conforme activates the portal', async () => {
    const { service, accountProvisioning, records } = createService([inquiry({ status: 'accepted' })]);
    const actor = { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true, verified: true, id: 'usr_pmcm' };

    await service.uploadConforme('inq_existing', { fileName: 'signed-conforme.pdf', storageObjectId: 'obj_conforme' }, actor as ResolvedEventOpsActor);

    expect(records[0]).toMatchObject({ conformeSignedAt: expect.any(Date), portalInvitationStatus: 'not_sent' });
    expect(accountProvisioning.provision).not.toHaveBeenCalled();
  });
});
