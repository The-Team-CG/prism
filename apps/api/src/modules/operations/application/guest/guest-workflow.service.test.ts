import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import type { CommandReceiptCreate, CommandReceiptKey, CommandReceiptRecord, CommandReceiptStore } from '@prism/kernel/event-core';
import { PrismTransactionRunner } from '@prism/kernel/shared-kernel';
import { GuestWorkflowService } from './guest-workflow.service';

let guestCheckInRequestSequence = 0;

function withGuestCheckInKey<T extends { checkInMode: 'name_search' | 'headcount' | 'qr_pass' }>(input: T): T & { idempotencyKey: string } {
  guestCheckInRequestSequence += 1;
  const suffix = guestCheckInRequestSequence.toString(16).padStart(12, '0');
  return { ...input, idempotencyKey: `00000000-0000-4000-8000-${suffix}` };
}

function createCommandReceiptStore(): CommandReceiptStore {
  const receipts = new Map<string, CommandReceiptRecord>();
  const byId = new Map<string, CommandReceiptRecord>();
  const keyOf = (key: CommandReceiptKey) => JSON.stringify([key.commandName, key.idempotencyKey, key.actorId, key.eventScope]);
  let sequence = 0;
  return {
    find: vi.fn(async (key: CommandReceiptKey) => receipts.get(keyOf(key)) ?? null),
    create: vi.fn(async (input: CommandReceiptCreate) => {
      sequence += 1;
      const receipt: CommandReceiptRecord = {
        ...input,
        id: `cmd_receipt_${sequence}`,
        eventId: input.eventId ?? null,
        payloadHash: input.payloadHash ?? null,
        result: null,
        completedAt: new Date(),
      };
      receipts.set(keyOf(receipt), receipt);
      byId.set(receipt.id, receipt);
      return { id: receipt.id };
    }),
    complete: vi.fn(async (id: string, result: unknown) => {
      const receipt = byId.get(id);
      if (receipt) {
        receipt.result = result;
        receipt.completedAt = new Date();
      }
    }),
  };
}

const testEventReferences = {
  findOperationsEvent: vi.fn(async (id: string) => ({
    id,
    eventName: 'Test Event',
    eventDate: new Date('2026-06-18T00:00:00.000Z'),
    status: 'event_day',
    archived: false,
    actualEndedAt: new Date('2026-09-07T12:00:00.000Z'),
    walkInPolicy: 'open',
    walkInThreshold: 200,
  })),
  findGuestCheckInEventReference: vi.fn(async (id: string) => ({
    id,
    eventName: 'Test Event',
    walkInPolicy: 'open',
    walkInThreshold: 200,
    guestPrivacyClassification: 'public',
    briefingGuestCount: 200,
  })),
};

const createTestGuestEventProjections = () => ({
  listGuestAccessCandidates: vi.fn(async () => []),
  findGuestEvent: vi.fn(async () => null),
  listCoordinatorWorkspaceEvents: vi.fn(async () => []),
});

function createGuestWorkflowFixture(guestQrPassService = {
  isDemoEnabledForEvent: vi.fn(() => true),
  revokeForRosterEntries: vi.fn(async (_eventId: string, _rosterIds: readonly string[], _actor: unknown, _context?: unknown) => undefined),
}) {
  const state = {
    events: [
      {
        id: 'evt_sample',
        inquiryId: 'inq_sample',
        eventName: 'Ayala Tech Summit',
        clientName: 'Ana Reyes',
        eventDate: new Date('2026-06-18T00:00:00.000Z'),
        // Load-bearing: the seven-day window boundary test asserts against this
        // exact instant. Tests that write feedback must pin the clock.
        actualEndedAt: new Date('2026-09-07T12:00:00.000Z') as Date | null,
        actualEndedBy: 'user_pmcm',
        status: 'event_day',
        clientPortalStatus: 'unlocked',
        readiness: 'Registration open',
        walkInPolicy: 'open',
        walkInThreshold: 200,
        guestPrivacyClassification: 'public',
        briefingGuestCount: 200,
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
        rosterEntryId: null as string | null,
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
    guestRoster: [] as any[],
    guestQrPasses: [] as any[],
    guestFeedback: [] as any[],
  };

  const prisma = {
    opsEvent: {
      findMany: vi.fn(async ({ where }: any = {}) => state.events.filter((event) => where?.archived === undefined || event.archived === where.archived)),
      findFirst: vi.fn(async ({ where }: any) => state.events.find((event) => event.id === where.id && (where.archived === undefined || event.archived === where.archived)) ?? null),
      findUnique: vi.fn(async ({ where }: any) => state.events.find((event) => event.id === where.id) ?? null),
    },
    opsGuestRosterEntry: {
      findMany: vi.fn(async ({ where }: any = {}) => state.guestRoster.filter((entry) =>
        (!where?.eventId || entry.eventId === where.eventId)
        && (!where?.normalizedName || entry.normalizedName === where.normalizedName)
        && (where?.eligibility === undefined || entry.eligibility === where.eligibility)
        && (where?.withdrawnAt === undefined || (where.withdrawnAt === null ? entry.withdrawnAt == null : entry.withdrawnAt === where.withdrawnAt))
        && (where?.verificationStatus?.not === undefined || entry.verificationStatus !== where.verificationStatus.not)
        && (where?.source?.not === undefined || entry.source !== where.source.not)
        && (where?.source?.notIn === undefined || !where.source.notIn.includes(entry.source)),
      )),
      findFirst: vi.fn(async ({ where }: any) => state.guestRoster.find((entry) =>
        (!where?.id || entry.id === where.id)
        && (!where?.eventId || entry.eventId === where.eventId)
        && (where?.normalizedName === undefined || entry.normalizedName === where.normalizedName)
        && (where?.source === undefined || entry.source === where.source)
        && (where?.eligibility === undefined || entry.eligibility === where.eligibility)
        && (where?.source?.not === undefined || entry.source !== where.source.not)
        && (where?.source?.notIn === undefined || !where.source.notIn.includes(entry.source))
        && (where?.verificationStatus === undefined || (typeof where.verificationStatus === 'object'
          ? where.verificationStatus.not === undefined || entry.verificationStatus !== where.verificationStatus.not
          : entry.verificationStatus === where.verificationStatus))
        && (where?.withdrawnAt === undefined || (where.withdrawnAt === null ? entry.withdrawnAt == null : entry.withdrawnAt === where.withdrawnAt)),
      ) ?? null),
      create: vi.fn(async ({ data }: any) => {
        const now = new Date('2026-10-02T09:00:00.000Z');
        const row = { ...data, checkedInAt: null, withdrawnAt: null, createdAt: now, updatedAt: now };
        state.guestRoster.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(state.guestRoster.find((entry) => entry.id === where.id)!, data)),
    },
    opsGuestQrPass: {
      findFirst: vi.fn(async ({ where }: any) => state.guestQrPasses.find((pass) =>
        pass.eventId === where.eventId && pass.tokenHash === where.tokenHash && pass.status === where.status,
      ) ?? null),
    },
    opsGuestCheckIn: {
      count: vi.fn(async ({ where }: any = {}) =>
        state.guestCheckIns.filter((item) =>
          (!where?.eventId || item.eventId === where.eventId) && (!where?.status || item.status === where.status),
        ).length,
      ),
      findFirst: vi.fn(async ({ where }: any) => state.guestCheckIns.find((item) =>
        item.eventId === where.eventId && item.rosterEntryId === where.rosterEntryId && (!where.status || item.status === where.status),
      ) ?? null),
      findMany: vi.fn(async ({ where }: any = {}) => {
        const eventIds = where?.eventId?.in as string[] | undefined;
        return state.guestCheckIns.filter((item) =>
          (eventIds ? eventIds.includes(item.eventId) : !where?.eventId || item.eventId === where.eventId)
          && (where?.status === undefined || item.status === where.status),
        );
      }),
      create: vi.fn(async ({ data }: any) => {
        const row = { ...data, checkedInAt: new Date('2026-06-18T09:00:00.000Z') };
        state.guestCheckIns.push(row);
        return row;
      }),
      createMany: vi.fn(async ({ data, skipDuplicates }: any) => {
        let count = 0;
        for (const item of Array.isArray(data) ? data : [data]) {
          const duplicate = state.guestCheckIns.some((checkIn) =>
            checkIn.eventId === item.eventId && checkIn.rosterEntryId === item.rosterEntryId,
          );
          if (duplicate && skipDuplicates) continue;
          if (duplicate) throw Object.assign(new Error('duplicate attendance'), { code: 'P2002' });
          state.guestCheckIns.push({ ...item, checkedInAt: new Date('2026-06-18T09:00:00.000Z') });
          count += 1;
        }
        return { count };
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
        const row = {
          ...data,
          mediaAttachments: data.mediaAttachments?.create ?? [],
          submittedAt: new Date('2026-06-18T10:00:00.000Z'),
        };
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
    $queryRaw: vi.fn(async () => []),
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(prisma)),
  };
  const auditWriter = { write: vi.fn() };
  const staffingReader = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'asg_registration', role: 'Registration Staff', status: 'acknowledged' })) };
  const eventReferences = {
    findOperationsEvent: vi.fn(async (eventId: string, _context?: { prisma: any }) => {
      const event = state.events.find((candidate) => candidate.id === eventId);
      if (!event) return null;
      return {
        id: event.id,
        eventName: event.eventName,
        eventDate: event.eventDate,
        status: event.status,
        archived: event.archived,
        actualEndedAt: event.actualEndedAt,
        walkInPolicy: event.walkInPolicy,
        walkInThreshold: event.walkInThreshold,
      };
    }),
    findGuestCheckInEventReference: vi.fn(async (eventId: string) => {
      const event = state.events.find((candidate) => candidate.id === eventId);
      if (!event) return null;
      return {
        id: event.id,
        eventName: event.eventName,
        walkInPolicy: event.walkInPolicy,
        walkInThreshold: event.walkInThreshold,
        guestPrivacyClassification: event.guestPrivacyClassification,
        briefingGuestCount: event.briefingGuestCount,
      };
    }),
  };
  const eventProjections = {
    listGuestAccessCandidates: vi.fn(async (includeArchived: boolean) => state.events
      .filter((event) => includeArchived || !event.archived)
      .map(({ id, eventName, eventDate, updatedAt, archived }) => ({ id, eventName, eventDate, updatedAt, archived }))),
    findGuestEvent: vi.fn(async (eventId: string) => state.events.find((event) => event.id === eventId) ?? null),
    listCoordinatorWorkspaceEvents: vi.fn(async () => []),
  };
  const service = new GuestWorkflowService(
    prisma as any,
    auditWriter as any,
    new WorkflowCommandService(new PrismTransactionRunner(prisma as any), createCommandReceiptStore()),
    staffingReader as any,
    eventReferences as any,
    eventProjections as any,
    guestQrPassService as any,
  );

  return { service, state, prisma, auditWriter, staffingReader, eventReferences, eventProjections, guestQrPassService };
}

function guestRosterFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gre_1',
    eventId: 'evt_sample',
    sourceKey: 'pmcm:gre_1',
    guestName: 'Sofia Lim',
    normalizedName: 'sofia lim',
    email: '',
    phone: '',
    category: '',
    table: '',
    eligibility: 'eligible',
    verificationStatus: 'verified',
    source: 'PMCM',
    privacyConsentAccepted: false,
    privacyNoticeVersion: '',
    privacyConsentCapturedAt: null,
    importBatchId: null,
    checkedInAt: null,
    withdrawnAt: null,
    createdAt: new Date('2026-10-02T09:00:00.000Z'),
    updatedAt: new Date('2026-10-02T09:00:00.000Z'),
    ...overrides,
  };
}

const QR_TEST_TOKEN = 'A'.repeat(43);
const qrTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

function addActiveQrPass(
  state: ReturnType<typeof createGuestWorkflowFixture>['state'],
  token = QR_TEST_TOKEN,
  rosterOverrides: Record<string, unknown> = {},
) {
  state.events[0]!.actualEndedAt = null;
  state.events[0]!.status = 'event_day';
  state.guestCheckIns.length = 0;
  const roster = guestRosterFixture({
    id: 'gre_qr_guest',
    source: 'csv-import',
    importBatchId: 'batch_qr_1',
    email: 'sofia@example.test',
    ...rosterOverrides,
  });
  state.guestRoster.push(roster);
  state.guestQrPasses.push({
    id: 'gqp_1',
    eventId: 'evt_sample',
    rosterEntryId: roster.id,
    tokenHash: qrTokenHash(token),
    status: 'active',
  });
  return roster;
}

function qrCheckInInput(token = QR_TEST_TOKEN, overrides: Record<string, unknown> = {}) {
  return withGuestCheckInKey({
    checkInMode: 'qr_pass' as const,
    passToken: token,
    privacyConsentAccepted: true,
    ...overrides,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GuestWorkflowService', () => {
  it('resolves a guest event and returns attendance counts by access code', async () => {
    const { service, eventProjections } = createGuestWorkflowFixture();

    await expect(service.getEventByAccessCode('AYALA-TECH-MPLE')).resolves.toMatchObject({
      id: 'evt_sample',
      eventName: 'Ayala Tech Summit',
    });
    expect(eventProjections.listGuestAccessCandidates).toHaveBeenCalledWith(false);
    expect(eventProjections.findGuestEvent).toHaveBeenCalledWith('evt_sample');
    await expect(service.countCheckInsForEvent('evt_sample')).resolves.toBe(1);
  });

  it('keeps public guest pass and watermark free of attendance signals', async () => {
    const { service, state, prisma } = createGuestWorkflowFixture();

    await expect(service.getEventWatermarkByAccessCode('AYALA-TECH-MPLE')).resolves.toEqual({
      watermark: '2026-06-01T00:00:00.000Z',
    });
    const pass = service.mapGuestEvent(state.events[0] as any);
    expect(pass).not.toHaveProperty('attendanceCount');
    expect(pass.watermark).toBe('2026-06-01T00:00:00.000Z');
    expect(prisma.opsGuestCheckIn.count).not.toHaveBeenCalled();

    state.guestCheckIns.push({ ...state.guestCheckIns[0], id: 'gci_new' });
    await expect(service.getEventWatermarkByAccessCode('AYALA-TECH-MPLE')).resolves.toEqual({
      watermark: '2026-06-01T00:00:00.000Z',
    });
    expect(prisma.opsGuestCheckIn.count).not.toHaveBeenCalled();
  });

  it('counts and lists checked-in records only', async () => {
    const { service, state, prisma } = createGuestWorkflowFixture();
    state.guestCheckIns.push(
      { ...state.guestCheckIns[0], id: 'gci_pending', status: 'pending' },
      { ...state.guestCheckIns[0], id: 'gci_rejected', status: 'rejected' },
    );

    await expect(service.countCheckInsForEvent('evt_sample')).resolves.toBe(1);
    await expect(service.listCheckInsForEvent('evt_sample')).resolves.toHaveLength(1);
    expect(prisma.opsGuestCheckIn.count).toHaveBeenCalledWith({ where: { eventId: 'evt_sample', status: 'checked_in' } });
    expect(prisma.opsGuestCheckIn.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: 'evt_sample', status: 'checked_in' },
    }));
  });

  it('keeps the watermark route subject to the ordinary guest archive policy', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.events[0].archived = true;
    await expect(service.getEventWatermarkByAccessCode('AYALA-TECH-MPLE')).rejects.toThrow('Guest event code was not found');
  });

  it('checks in only a unique normalized roster match and makes retries idempotent', async () => {
    const { service, state, prisma } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.guestRoster.push(guestRosterFixture({ id: 'gre_sofia', normalizedName: 'sofia lim' }));
    const input = withGuestCheckInKey({ checkInMode: 'name_search' as const, guestName: ' SOFIA LIM ', privacyConsentAccepted: true });

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', input)).resolves.toEqual({ accepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', input)).resolves.toEqual({ accepted: true });

    expect(prisma.opsGuestRosterEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventId: 'evt_sample', normalizedName: 'sofia lim', eligibility: 'eligible', withdrawnAt: null }),
      take: 2,
    }));
    expect(state.guestCheckIns).toHaveLength(1);
    expect(state.guestCheckIns[0]).toMatchObject({
      rosterEntryId: 'gre_sofia', guestName: 'Sofia Lim', checkInMode: 'name_search',
      walkIn: false, status: 'checked_in',
    });
  });

  it('makes retries idempotent when a name does not match an existing roster row', async () => {
    const { service, state, prisma } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    const request = withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'Unmatched Guest', privacyConsentAccepted: true,
    });

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });

    expect(prisma.opsGuestCheckIn.create).toHaveBeenCalledTimes(1);
    expect(state.guestCheckIns).toHaveLength(1);
  });

  it('redeems an active event-bound QR pass as canonical name-search attendance', async () => {
    const { service, state, prisma, auditWriter } = createGuestWorkflowFixture();
    const roster = addActiveQrPass(state);

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput())).resolves.toEqual({ accepted: true });

    expect(prisma.opsGuestQrPass.findFirst).toHaveBeenCalledWith({
      where: { eventId: 'evt_sample', tokenHash: qrTokenHash(QR_TEST_TOKEN), status: 'active' },
    });
    expect(state.guestCheckIns).toHaveLength(1);
    expect(state.guestCheckIns[0]).toMatchObject({
      eventId: 'evt_sample',
      rosterEntryId: roster.id,
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      status: 'checked_in',
      walkIn: false,
      verificationStatus: 'verified',
      privacyConsentAccepted: true,
    });
    expect(state.guestRoster[0]?.checkedInAt).toBeInstanceOf(Date);
    expect(JSON.stringify(auditWriter.write.mock.calls)).not.toContain(QR_TEST_TOKEN);
    expect(JSON.stringify(auditWriter.write.mock.calls)).not.toContain(qrTokenHash(QR_TEST_TOKEN));
  });

  it('keeps QR redemption disabled when the synthetic demo gate is off', async () => {
    const { service, state, prisma, guestQrPassService } = createGuestWorkflowFixture();
    addActiveQrPass(state);
    guestQrPassService.isDemoEnabledForEvent.mockReturnValue(false);

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput()))
      .rejects.toThrow('Guest check-in could not be completed');

    expect(prisma.opsGuestQrPass.findFirst).not.toHaveBeenCalled();
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it('does not acknowledge a QR pass when a non-checked-in row occupies its attendance key', async () => {
    const { service, state } = createGuestWorkflowFixture();
    const roster = addActiveQrPass(state);
    state.guestCheckIns.push({
      id: 'gci_pending_qr',
      eventId: 'evt_sample',
      rosterEntryId: roster.id,
      guestName: roster.guestName,
      checkInMode: 'name_search',
      status: 'pending',
      walkIn: false,
      verificationStatus: 'pending',
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-10-01',
      marketingConsentAccepted: false,
      checkedInAt: new Date('2026-06-18T09:00:00.000Z'),
    });

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput()))
      .rejects.toThrow('Guest check-in could not be completed');
    expect(state.guestCheckIns).toHaveLength(1);
    expect(roster.checkedInAt).toBeNull();
  });

  it('binds a QR pass to the event resolved from the access code', async () => {
    const { service, state } = createGuestWorkflowFixture();
    addActiveQrPass(state);
    const otherEvent = {
      ...state.events[0],
      id: 'evt_other',
      eventName: 'Other Event',
      actualEndedAt: null,
    };
    state.events.push(otherEvent);
    const otherAccessCode = service.guestAccessCode(otherEvent as any);

    await expect(service.checkInByAccessCode(otherAccessCode, qrCheckInInput())).rejects.toThrow('Guest check-in could not be completed');
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it.each([
    ['malformed token', () => 'not a base64url token!', (_state: any) => undefined],
    ['unknown token', () => 'B'.repeat(43), (_state: any) => undefined],
    ['revoked pass', () => QR_TEST_TOKEN, (state: any) => { state.guestQrPasses[0]!.status = 'revoked'; }],
    ['withdrawn roster entry', () => QR_TEST_TOKEN, (state: any) => { state.guestRoster[0]!.withdrawnAt = new Date(); }],
    ['ineligible roster entry', () => QR_TEST_TOKEN, (state: any) => { state.guestRoster[0]!.eligibility = 'ineligible'; }],
    ['rejected roster entry', () => QR_TEST_TOKEN, (state: any) => { state.guestRoster[0]!.verificationStatus = 'rejected'; }],
    ['no longer imported roster entry', () => QR_TEST_TOKEN, (state: any) => { state.guestRoster[0]!.importBatchId = null; }],
    ['review roster entry', () => QR_TEST_TOKEN, (state: any) => { state.guestRoster[0]!.source = 'guest-review'; }],
  ])('returns the same generic error for a %s', async (_label, tokenFor, invalidate) => {
    const { service, state } = createGuestWorkflowFixture();
    addActiveQrPass(state);
    invalidate(state);

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput(tokenFor()))).rejects.toThrow('Guest check-in could not be completed');
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it.each([
    ['actual-ended event', (event: any) => { event.actualEndedAt = new Date('2026-09-07T12:00:00.000Z'); }],
    ['archived event flag', (event: any) => { event.archived = true; }],
    ['archived event status', (event: any) => { event.status = 'archived'; }],
  ])('does not redeem a QR pass for an %s', async (_label, closeEvent) => {
    const { service, state } = createGuestWorkflowFixture();
    addActiveQrPass(state);
    closeEvent(state.events[0]);

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput())).rejects.toThrow('Guest check-in could not be completed');
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it('requires the existing S02 privacy consent before QR attendance can be written', async () => {
    const { service, state } = createGuestWorkflowFixture();
    addActiveQrPass(state);

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput(QR_TEST_TOKEN, { privacyConsentAccepted: false })))
      .rejects.toThrow('Guest check-in could not be completed');
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it('deduplicates simultaneous scans and feeds existing attendance and Registration Desk projections', async () => {
    const { service, state, prisma, auditWriter } = createGuestWorkflowFixture();
    addActiveQrPass(state);

    await expect(Promise.all([
      service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput()),
      service.checkInByAccessCode('AYALA-TECH-MPLE', qrCheckInInput()),
    ])).resolves.toEqual([{ accepted: true }, { accepted: true }]);

    expect(prisma.opsGuestCheckIn.createMany).toHaveBeenCalledTimes(2);
    expect(state.guestCheckIns).toHaveLength(1);
    expect(state.guestCheckIns[0]).toMatchObject({ checkInMode: 'name_search', rosterEntryId: 'gre_qr_guest' });
    await expect(service.countCheckInsForEvent('evt_sample')).resolves.toBe(1);
    await expect(service.listCheckInsForEvent('evt_sample')).resolves.toEqual([
      expect.objectContaining({ checkInMode: 'name_search', rosterEntryId: 'gre_qr_guest', guestName: 'Sofia Lim' }),
    ]);
    await expect(service.searchCoordinatorRoster('evt_sample', { id: 'usr_registration', name: 'Registration Staff', role: 'coordinator' }))
      .resolves.toEqual([expect.objectContaining({ id: 'gre_qr_guest', checkedInAt: expect.any(String), walkIn: false })]);
    expect(auditWriter.write).toHaveBeenCalledTimes(1);
  });

  it('rejects reuse of a guest check-in key for different content', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    const request = withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'First Guest', privacyConsentAccepted: true,
    });

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', {
      ...request, guestName: 'Different Guest',
    })).rejects.toThrow('Command idempotency key was reused for different content');
    expect(state.guestCheckIns).toHaveLength(1);
  });

  it('queues ambiguous roster matches for staff review even when New-CL1 does not apply', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.guestRoster.push(
      guestRosterFixture({ id: 'gre_one', guestName: 'Sofia Lim', normalizedName: 'sofia lim' }),
      guestRosterFixture({ id: 'gre_two', guestName: 'Sofia Lim', normalizedName: 'sofia lim' }),
    );
    const input = withGuestCheckInKey({ checkInMode: 'name_search' as const, guestName: 'Sofia Lim', privacyConsentAccepted: true });

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', input)).resolves.toEqual({ accepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', input)).resolves.toEqual({ accepted: true });

    expect(state.guestRoster.filter((entry) => entry.source === 'guest-review')).toHaveLength(1);
    expect(state.guestRoster.find((entry) => entry.source === 'guest-review')).toMatchObject({
      guestName: 'Sofia Lim', verificationStatus: 'pending', checkedInAt: null,
    });
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it.each([
    ['missing', []],
    ['ambiguous', [guestRosterFixture({ id: 'gre_one' }), guestRosterFixture({ id: 'gre_two' })]],
    ['ineligible', [guestRosterFixture({ eligibility: 'ineligible' })]],
    ['withdrawn', [guestRosterFixture({ withdrawnAt: new Date('2026-10-01T00:00:00.000Z') })]],
  ])('queues %s name submissions for New-CL1 without counting attendance', async (_caseName, rows) => {
    const { service, state } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.guestRoster.push(...rows);
    state.events[0].guestPrivacyClassification = 'private';
    state.events[0].briefingGuestCount = 199;

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'New Guest', privacyConsentAccepted: true,
    }))).resolves.toEqual({ accepted: true });

    const pending = state.guestRoster.find((entry) => entry.source === 'guest-review');
    expect(pending).toMatchObject({
      guestName: 'New Guest', normalizedName: 'new guest', eligibility: 'eligible',
      verificationStatus: 'pending', checkedInAt: null,
    });
    expect(pending.sourceKey).toContain('guest-review:');
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it('does not let public retries bypass a pending New-CL1 verification row', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.events[0].guestPrivacyClassification = 'private';
    state.events[0].briefingGuestCount = 199;
    state.guestRoster.push(guestRosterFixture({
      source: 'guest-review', sourceKey: 'guest-review:gre_pending',
      guestName: 'New Guest', normalizedName: 'new guest', verificationStatus: 'pending',
    }));

    const request = withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'New Guest', privacyConsentAccepted: true,
    });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });

    expect(state.guestRoster).toHaveLength(1);
    expect(state.guestRoster[0]?.checkedInAt).toBeNull();
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it('does not let public name matching bypass a pending coordinator walk-in review', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.guestRoster.push(guestRosterFixture({
      source: 'coordinator-walk-in', sourceKey: 'coordinator-walk-in:gre_pending',
      guestName: 'Walk-In Guest', normalizedName: 'walk-in guest', verificationStatus: 'pending',
    }));

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'Walk-In Guest', privacyConsentAccepted: true,
    }))).resolves.toEqual({ accepted: true });

    expect(state.guestRoster).toHaveLength(1);
    expect(state.guestRoster[0]?.checkedInAt).toBeNull();
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it.each([
    ['private below 200', 'private', 199, true],
    ['private at 200', 'private', 200, false],
    ['public below 200', 'public', 199, false],
    ['unclassified', 'unclassified', 199, true],
    ['missing briefing count', 'public', null, true],
  ])('applies the conservative New-CL1 rule for %s', async (_caseName, classification, guestCount, queued) => {
    const { service, state } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.events[0].guestPrivacyClassification = classification;
    (state.events[0] as any).briefingGuestCount = guestCount;

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'Walk In Guest', privacyConsentAccepted: true,
    }))).resolves.toEqual({ accepted: true });

    expect(state.guestRoster.some((entry) => entry.source === 'guest-review' || entry.source === 'guest-review-headcount')).toBe(queued);
    expect(state.guestCheckIns).toHaveLength(queued ? 0 : 1);
    if (!queued) expect(state.guestCheckIns[0]).toMatchObject({ guestName: 'Walk In Guest', walkIn: true, status: 'checked_in' });
  });

  it('records headcount anonymously without searching the roster when New-CL1 does not apply', async () => {
    const { service, state, prisma } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'headcount', privacyConsentAccepted: true,
    }))).resolves.toEqual({ accepted: true });

    expect(prisma.opsGuestRosterEntry.findMany).not.toHaveBeenCalled();
    expect(state.guestCheckIns).toHaveLength(1);
    expect(state.guestCheckIns[0]).toMatchObject({
      guestName: null, rosterEntryId: null, checkInMode: 'headcount', walkIn: true, status: 'checked_in',
    });
  });

  it('queues New-CL1 headcount with only the fixed anonymous label', async () => {
    const { service, state, prisma } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.events[0].guestPrivacyClassification = 'private';
    state.events[0].briefingGuestCount = 199;

    const request = withGuestCheckInKey({
      checkInMode: 'headcount', privacyConsentAccepted: true,
    });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });

    expect(prisma.opsGuestRosterEntry.findMany).not.toHaveBeenCalled();
    expect(state.guestRoster).toContainEqual(expect.objectContaining({
      guestName: 'Anonymous headcount', normalizedName: 'anonymous headcount', email: '', phone: '',
      source: 'guest-review-headcount', verificationStatus: 'pending', checkedInAt: null,
    }));
    expect(state.guestRoster.filter((entry) => entry.source === 'guest-review-headcount')).toHaveLength(1);
    expect(state.guestCheckIns).toHaveLength(0);
  });

  it('counts a New-CL1 submission only after Registration Staff verifies and checks it in', async () => {
    const { service, state, auditWriter } = createGuestWorkflowFixture();
    state.guestCheckIns.length = 0;
    state.events[0].guestPrivacyClassification = 'private';
    state.events[0].briefingGuestCount = 199;
    state.events[0].walkInPolicy = 'threshold';
    state.events[0].walkInThreshold = 1;
    const registrationActor = { id: 'usr_registration', name: 'Registration Staff', role: 'coordinator' };

    const request = withGuestCheckInKey({
      checkInMode: 'headcount', privacyConsentAccepted: true, privacyNoticeVersion: '2026-04-01',
    });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', request)).resolves.toEqual({ accepted: true });
    expect(state.guestCheckIns).toHaveLength(0);

    const pending = state.guestRoster[0]!;
    expect(pending).toMatchObject({ guestName: 'Anonymous headcount', source: 'guest-review-headcount', verificationStatus: 'pending', checkedInAt: null });
    expect(pending).toMatchObject({
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-04-01',
      privacyConsentCapturedAt: expect.any(Date),
    });
    await expect(service.checkInRosterEntry('evt_sample', pending.id, registrationActor)).rejects.toThrow('must be verified');

    await service.updateVerification('evt_sample', pending.id, { status: 'verified' }, registrationActor);
    const checkIn = await service.checkInRosterEntry('evt_sample', pending.id, registrationActor);

    expect(checkIn).toMatchObject({
      guestName: null, rosterEntryId: pending.id, checkInMode: 'headcount',
      walkIn: true, verificationStatus: 'verified', status: 'checked_in',
      privacyConsentAccepted: true,
      privacyNoticeVersion: '2026-04-01',
      privacyConsentCapturedAt: pending.privacyConsentCapturedAt,
    });
    expect(pending.checkedInAt).toBeInstanceOf(Date);
    expect(state.guestCheckIns).toHaveLength(1);
    expect(auditWriter.write).toHaveBeenCalledTimes(3);
    await expect(service.checkInRosterEntry('evt_sample', pending.id, registrationActor)).resolves.toMatchObject({ id: checkIn.id });
    expect(state.guestCheckIns).toHaveLength(1);
  });

  it.each([
    ['closed', 'Walk-in registration is closed for this event'],
    ['threshold', 'Walk-in registration threshold has been reached for this event'],
  ])('rejects a New-CL1 submission when walk-in policy is %s', async (policy, message) => {
    const { service, state } = createGuestWorkflowFixture();
    state.events[0].guestPrivacyClassification = 'private';
    state.events[0].briefingGuestCount = 199;
    if (policy === 'closed') state.events[0].walkInPolicy = 'closed';
    else {
      state.events[0].walkInPolicy = 'threshold';
      state.events[0].walkInThreshold = 1;
    }

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'New Guest', privacyConsentAccepted: true,
    }))).rejects.toThrow(message);
    expect(state.guestRoster).toHaveLength(0);
    expect(state.guestCheckIns).toHaveLength(1);
  });

  it('rechecks walk-in policy before staff checks in a verified New-CL1 row', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.events[0].walkInPolicy = 'closed';
    state.guestRoster.push(guestRosterFixture({
      source: 'guest-review', sourceKey: 'guest-review:gre_pending',
      verificationStatus: 'verified', checkedInAt: null,
    }));

    await expect(service.checkInRosterEntry('evt_sample', 'gre_1', {
      name: 'Registration Staff', role: 'coordinator',
    })).rejects.toThrow('Walk-in registration is closed for this event');
    expect(state.guestRoster[0].checkedInAt).toBeNull();
    expect(state.guestCheckIns).toHaveLength(1);
  });

  it('requires privacy consent before guest check-in writes', async () => {
    const { service } = createGuestWorkflowFixture();

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({ checkInMode: 'name_search', guestName: 'Sofia Lim' }))).rejects.toThrow(
      'Privacy consent is required before guest check-in',
    );
  });

  it('fails closed when guest roster persistence is unavailable', async () => {
    const { service, prisma } = createGuestWorkflowFixture();
    delete (prisma as { opsGuestRosterEntry?: unknown }).opsGuestRosterEntry;

    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search',
      guestName: 'Sofia Lim',
      privacyConsentAccepted: true,
    }))).rejects.toThrow('Guest roster persistence is unavailable');
    expect(prisma.opsGuestCheckIn.create).not.toHaveBeenCalled();
  });

  it('does not allow archived events to resolve ordinary guest check-in access', async () => {
    const { service, state } = createGuestWorkflowFixture();
    state.events[0].archived = true;
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search',
      guestName: 'Archived Guest', privacyConsentAccepted: true,
    }))).rejects.toThrow('Guest event code was not found');
  });

  it('records guest check-ins and moderated feedback through command methods', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    const { service, auditWriter } = createGuestWorkflowFixture();

    const checkIn = await service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      guestName: 'Sofia Lim',
      checkInMode: 'name_search',
      privacyConsentAccepted: true,
    }));
    const feedback = await service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      rating: 5,
      comment: 'Smooth registration.',
      privacyConsentAccepted: true,
    });

    expect(checkIn).toEqual({ accepted: true });
    expect(feedback).toMatchObject({ eventId: 'evt_sample', submittedAt: expect.any(String) });
    expect(feedback).not.toHaveProperty('guestName');
    expect(feedback).not.toHaveProperty('moderationStatus');
    expect(auditWriter.write).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
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
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'Walk In Guest', privacyConsentAccepted: true,
    }))).rejects.toThrow(message);
  });

  it('permits open and available threshold walk-ins', async () => {
    const { service, state } = createGuestWorkflowFixture();
    (state.events[0] as any).walkInPolicy = 'open';
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'Open Walk In', privacyConsentAccepted: true,
    }))).resolves.toEqual({ accepted: true });
    (state.events[0] as any).walkInPolicy = 'threshold';
    (state.events[0] as any).walkInThreshold = 4;
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'Threshold Walk In', privacyConsentAccepted: true,
    }))).resolves.toEqual({ accepted: true });
    expect(state.guestCheckIns.slice(-2).map((checkIn) => checkIn.guestName)).toEqual(['Open Walk In', 'Threshold Walk In']);
  });

  it('deduplicates roster check-in by roster identity when names repeat', async () => {
    const roster = [
      { id: 'gre_one', eventId: 'evt_sample', guestName: 'Maria Santos', eligibility: 'eligible', verificationStatus: 'pending', withdrawnAt: null, checkedInAt: null },
      { id: 'gre_two', eventId: 'evt_sample', guestName: 'Maria Santos', eligibility: 'eligible', verificationStatus: 'pending', withdrawnAt: null, checkedInAt: null },
    ];
    const checkIns: any[] = [];
    const tx = {
      $queryRaw: vi.fn(),
      opsEvent: {
        findFirst: vi.fn(async () => ({ id: 'evt_sample', archived: false })),
        findUnique: vi.fn(async () => ({ id: 'evt_sample', archived: false })),
      },
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
    const staffingReader = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'asg_registration', role: 'Registration Staff', status: 'acknowledged' })) };
    const service = new GuestWorkflowService(prisma as any, { write: vi.fn() } as any, new WorkflowCommandService(), staffingReader as any, testEventReferences as any, createTestGuestEventProjections() as any, { revokeForRosterEntries: vi.fn(async () => undefined) } as any);

    const first = await service.checkInRosterEntry('evt_sample', 'gre_one', { name: 'Registration', role: 'coordinator' });
    const second = await service.checkInRosterEntry('evt_sample', 'gre_two', { name: 'Registration', role: 'coordinator' });

    expect([first.rosterEntryId, second.rosterEntryId]).toEqual(['gre_one', 'gre_two']);
    expect(checkIns).toHaveLength(2);
    expect(roster.map((entry) => entry.checkedInAt)).toEqual([expect.any(Date), expect.any(Date)]);
  });

  it('filters the actionable coordinator review queue and returns submission times without contact details', async () => {
    const createdAt = new Date('2026-10-02T09:00:00.000Z');
    const findMany = vi.fn(async () => [{
      id: 'gre_1', eventId: 'evt_1', guestName: 'Mia Santos', category: 'VIP', table: 'A1', eligibility: 'eligible',
       verificationStatus: 'pending', checkedInAt: null, email: 'private@example.test', phone: '+63900000000', source: 'guest-review', createdAt,
    }]);
    const staffingReader = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'asg_1', role: 'Registration Staff', status: 'acknowledged' })) };
    const service = new GuestWorkflowService(
      { opsGuestRosterEntry: { findMany } } as any,
      { write: vi.fn() } as any,
      new WorkflowCommandService(),
      staffingReader as any,
      testEventReferences as any,
      createTestGuestEventProjections() as any,
      { revokeForRosterEntries: vi.fn(async () => undefined) } as any,
    );
    const actor = { id: 'usr_coord', email: 'coord@example.test', name: 'Mia Registration', role: 'coordinator' };

    await expect(service.searchCoordinatorRoster('evt_1', actor, { reviewQueue: true })).resolves.toEqual([{
      id: 'gre_1', eventId: 'evt_1', guestName: 'Mia Santos', category: 'VIP', table: 'A1', eligibility: 'eligible',
       verificationStatus: 'pending', checkedInAt: null, walkIn: true, reviewSubmittedAt: createdAt.toISOString(),
    }]);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        eventId: 'evt_1', checkedInAt: null,
        OR: [
          { verificationStatus: 'pending' },
          { source: { in: ['coordinator-walk-in', 'guest-review', 'guest-review-headcount'] }, verificationStatus: 'verified' },
        ],
      }),
      select: expect.objectContaining({ id: true, eventId: true, guestName: true, verificationStatus: true, createdAt: true }),
    }));
  });

  it('keeps guest contact details out of coordinator verification responses', async () => {
    const row = {
      id: 'gre_1', eventId: 'evt_1', sourceKey: 'source_1', guestName: 'Mia Santos', email: 'private@example.test', phone: '+63900000000',
      category: 'VIP', table: 'A1', eligibility: 'eligible', verificationStatus: 'pending', source: 'PMCM', importBatchId: null,
      checkedInAt: null, withdrawnAt: null, createdAt: new Date('2026-10-01T00:00:00.000Z'), updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    };
    const tx = {
      $queryRaw: vi.fn(),
      opsEvent: { findUnique: vi.fn(async () => ({ archived: false })) },
      opsGuestRosterEntry: {
        findFirst: vi.fn(async () => row),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...row, ...data })),
      },
    };
    const staffingReader = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'asg_1', role: 'Registration Staff', status: 'acknowledged' })) };
    const service = new GuestWorkflowService(
      { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) } as any,
      { write: vi.fn() } as any,
      new WorkflowCommandService(),
      staffingReader as any,
      testEventReferences as any,
      createTestGuestEventProjections() as any,
      { revokeForRosterEntries: vi.fn(async () => undefined) } as any,
    );

    await expect(service.updateVerification('evt_1', 'gre_1', { status: 'verified' }, {
      id: 'usr_coord', email: 'coord@example.test', name: 'Registration Staff', role: 'coordinator',
    })).resolves.toEqual({
      id: 'gre_1', eventId: 'evt_1', guestName: 'Mia Santos', category: 'VIP', table: 'A1', eligibility: 'eligible',
      verificationStatus: 'verified', checkedInAt: null, walkIn: false,
    });
  });

  it('denies coordinators outside a registration assignment before roster reads or writes', async () => {
    const findMany = vi.fn();
    const transaction = vi.fn();
    const staffingReader = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'asg_1', role: 'Usher', status: 'acknowledged' })) };
    const service = new GuestWorkflowService(
      { opsGuestRosterEntry: { findMany }, $transaction: transaction } as any,
      { write: vi.fn() } as any,
      new WorkflowCommandService(),
      staffingReader as any,
      testEventReferences as any,
      createTestGuestEventProjections() as any,
      { revokeForRosterEntries: vi.fn(async () => undefined) } as any,
    );
    const actor = { id: 'usr_coord', email: 'coord@example.test', name: 'Usher', role: 'coordinator' };

    await expect(service.searchCoordinatorRoster('evt_1', actor)).rejects.toThrow('Registration role');
    await expect(service.checkInRosterEntry('evt_1', 'gre_1', actor)).rejects.toThrow('Registration role');
    await expect(service.updateVerification('evt_1', 'gre_1', { status: 'verified' }, actor)).rejects.toThrow('Registration role');
    expect(findMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('serializes verification rejection with check-in and prevents rejecting an already checked-in guest', async () => {
    const { service, state, prisma, eventReferences } = createGuestWorkflowFixture();
    const actor = { id: 'usr_registration', name: 'Registration Staff', role: 'coordinator' };
    const roster = {
      id: 'gre_race', eventId: 'evt_sample', sourceKey: 'race-1', guestName: 'Mia Santos', normalizedName: 'mia santos',
      email: '', phone: '', category: 'VIP', table: 'A1', eligibility: 'eligible', verificationStatus: 'pending',
      source: 'PMCM', importBatchId: null, checkedInAt: null, withdrawnAt: null,
    };
    state.guestRoster.push(roster);

    await service.checkInRosterEntry('evt_sample', roster.id, actor);
    await expect(service.updateVerification('evt_sample', roster.id, { status: 'rejected' }, actor)).rejects.toThrow(
      'cannot change after check-in',
    );

    expect(roster.verificationStatus).toBe('pending');
    expect(roster.checkedInAt).toBeInstanceOf(Date);
    expect(eventReferences.findOperationsEvent).toHaveBeenCalledTimes(2);
    expect(eventReferences.findOperationsEvent).toHaveBeenCalledWith('evt_sample', expect.objectContaining({ prisma }));

    const rejectedRoster = { ...roster, id: 'gre_rejected', sourceKey: 'rejected-1', checkedInAt: null, verificationStatus: 'pending' };
    state.guestRoster.push(rejectedRoster);
    await service.updateVerification('evt_sample', rejectedRoster.id, { status: 'rejected' }, actor);
    await expect(service.checkInRosterEntry('evt_sample', rejectedRoster.id, actor)).rejects.toThrow('verification was rejected');
    expect(rejectedRoster.checkedInAt).toBeNull();
  });

  it('keeps archived registration records readable and rejects writes after the event lock', async () => {
    const { service, state, prisma, auditWriter, eventReferences } = createGuestWorkflowFixture();
    const actor = { id: 'usr_registration', name: 'Registration Staff', role: 'coordinator' };
    const roster = await service.registerWalkIn('evt_sample', { guestName: 'Historical Guest', privacyConsentAccepted: true }, actor);
    vi.clearAllMocks();
    // Archive wins when Lifecycle rechecks the event inside the command transaction.
    eventReferences.findOperationsEvent.mockImplementation(async (eventId: string, context?: { prisma: any }) => {
      if (context) state.events[0].archived = true;
      const current = state.events.find((candidate) => candidate.id === eventId);
      if (!current) return null;
      return {
        id: current.id, eventName: current.eventName, eventDate: current.eventDate, status: current.status,
        archived: current.archived, actualEndedAt: current.actualEndedAt, walkInPolicy: current.walkInPolicy,
        walkInThreshold: current.walkInThreshold,
      };
    });

    await expect(service.updateVerification('evt_sample', roster.id, { status: 'verified' }, actor)).rejects.toThrow('archived');
    await expect(service.checkInRosterEntry('evt_sample', roster.id, actor)).rejects.toThrow('archived');
    await expect(service.registerWalkIn('evt_sample', { guestName: 'New Guest', privacyConsentAccepted: true }, actor)).rejects.toThrow('archived');
    await expect(service.searchCoordinatorRoster('evt_sample', actor)).resolves.toEqual([
      expect.objectContaining({ id: roster.id, guestName: 'Historical Guest', verificationStatus: 'pending' }),
    ]);
    expect(prisma.opsGuestRosterEntry.update).not.toHaveBeenCalled();
    expect(prisma.opsGuestRosterEntry.create).not.toHaveBeenCalled();
    expect(prisma.opsGuestCheckIn.create).not.toHaveBeenCalled();
    expect(auditWriter.write).not.toHaveBeenCalled();
  });

  it('keeps PMCM walk-in review actionable through the shared registration roster', async () => {
    const { service, state, auditWriter, staffingReader } = createGuestWorkflowFixture();
    const coordinator = { id: 'usr_registration', email: 'staff@example.test', name: 'Registration Staff', role: 'coordinator' };
    const pmcm = { id: 'usr_pmcm', name: 'PMCM Admin', role: 'pmcm-admin' };

    const walkIn = await service.registerWalkIn('evt_sample', { guestName: 'Walk-In Guest', privacyConsentAccepted: true }, coordinator);

    expect(walkIn).toMatchObject({
      eventId: 'evt_sample', guestName: 'Walk-In Guest', category: 'Walk-in', eligibility: 'eligible',
      verificationStatus: 'pending', checkedInAt: null, walkIn: true,
    });
    expect(state.guestRoster).toHaveLength(1);
    expect(state.guestCheckIns).toHaveLength(1);
    expect(staffingReader.findAssignmentForEventActor).toHaveBeenCalledWith('evt_sample', coordinator);
    expect(auditWriter.write).toHaveBeenCalledOnce();
    expect(auditWriter.write.mock.calls[0]?.[0]).toMatchObject({
      actor: 'Registration Staff', actorRole: 'coordinator', eventId: 'evt_sample', affectedType: 'guest_roster_entry',
      metadata: { privacyConsentAccepted: true },
    });

    await service.updateVerification('evt_sample', walkIn.id, { status: 'verified' }, pmcm);
    const checkIn = await service.checkInRosterEntry('evt_sample', walkIn.id, coordinator);
    expect(checkIn).toMatchObject({
      eventId: 'evt_sample', guestName: 'Walk-In Guest', rosterEntryId: walkIn.id,
      checkInMode: 'walk_in', walkIn: true, verificationStatus: 'verified', privacyConsentAccepted: true,
    });
    expect(state.guestRoster[0]?.checkedInAt).toBeInstanceOf(Date);
  });

  it.each([
    ['closed', 'Walk-in registration is closed for this event'],
    ['threshold', 'Walk-in registration threshold has been reached for this event'],
  ])('requires available walk-in policy before adding a coordinator walk-in when %s', async (mode, message) => {
    const { service, state } = createGuestWorkflowFixture();
    if (mode === 'closed') state.events[0].walkInPolicy = 'closed';
    else {
      state.events[0].walkInPolicy = 'threshold';
      state.events[0].walkInThreshold = 1;
    }

    await expect(service.registerWalkIn('evt_sample', {
      guestName: 'Walk-In Guest', privacyConsentAccepted: true,
    }, { id: 'usr_registration', name: 'Registration Staff', role: 'coordinator' })).rejects.toThrow(message);
    expect(state.guestRoster).toHaveLength(0);
  });

  it('reserves the coordinator walk-in source from roster imports', async () => {
    const transaction = vi.fn();
    const service = new GuestWorkflowService(
      { $transaction: transaction } as any,
      { write: vi.fn() } as any,
      new WorkflowCommandService(),
      { findAssignmentForEventActor: vi.fn() } as any,
      testEventReferences as any,
      createTestGuestEventProjections() as any,
      { revokeForRosterEntries: vi.fn(async () => undefined) } as any,
    );

    await expect(service.importRoster('evt_1', { source: ' Coordinator-Walk-In ', rows: [] } as any, {
      id: 'usr_pmcm', name: 'PMCM Admin', role: 'pmcm-admin',
    })).rejects.toThrow('reserved roster source');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('revokes passes for import name or email changes, ineligibility, and removed rows in one transaction', async () => {
    const { service, state, prisma, guestQrPassService } = createGuestWorkflowFixture();
    const imported = 'Vendor List';
    state.guestRoster.push(
      guestRosterFixture({ id: 'gre_changed', sourceKey: 'vendor:changed', guestName: 'Before Name', normalizedName: 'before name', email: 'before@example.test', source: imported, importBatchId: 'old_batch' }),
      guestRosterFixture({ id: 'gre_ineligible', sourceKey: 'vendor:ineligible', guestName: 'Ineligible Guest', normalizedName: 'ineligible guest', email: 'ineligible@example.test', source: imported, importBatchId: 'old_batch' }),
      guestRosterFixture({ id: 'gre_removed', sourceKey: 'vendor:removed', guestName: 'Removed Guest', normalizedName: 'removed guest', email: 'removed@example.test', source: imported, importBatchId: 'old_batch' }),
    );
    const rosterModel = (prisma as any).opsGuestRosterEntry;
    rosterModel.findMany.mockImplementation(async ({ where = {} }: any = {}) => state.guestRoster.filter((entry) =>
      (!where.eventId || entry.eventId === where.eventId)
      && (!where.source || entry.source === where.source)
      && (!where.sourceKey?.in || where.sourceKey.in.includes(entry.sourceKey))
      && (!where.sourceKey?.notIn || !where.sourceKey.notIn.includes(entry.sourceKey))
      && (where.withdrawnAt !== null || entry.withdrawnAt == null),
    ));
    rosterModel.upsert = vi.fn(async ({ where, create, update }: any) => {
      const row = state.guestRoster.find((entry) => entry.eventId === where.eventId_sourceKey.eventId && entry.sourceKey === where.eventId_sourceKey.sourceKey);
      if (row) return Object.assign(row, update, { updatedAt: new Date() });
      const created = { ...create, checkedInAt: null, withdrawnAt: null, createdAt: new Date(), updatedAt: new Date() };
      state.guestRoster.push(created);
      return created;
    });
    rosterModel.updateMany = vi.fn(async ({ where, data }: any) => {
      const matches = state.guestRoster.filter((entry) => entry.eventId === where.eventId && entry.source === where.source
        && !where.sourceKey.notIn.includes(entry.sourceKey) && entry.withdrawnAt == null);
      matches.forEach((entry) => Object.assign(entry, data));
      return { count: matches.length };
    });
    (prisma as any).opsGuestRosterImport = { create: vi.fn(async ({ data }: any) => data) };

    await service.importRoster('evt_sample', { source: imported, rows: [
      { sourceKey: 'vendor:changed', guestName: 'Updated Name', email: ' UPDATED@example.test ', eligibility: 'eligible' },
      { sourceKey: 'vendor:ineligible', guestName: 'Ineligible Guest', email: 'ineligible@example.test', eligibility: 'ineligible' },
    ] } as any, { id: 'usr_pmcm', name: 'PMCM Admin', role: 'pmcm-admin' });

    expect(state.guestRoster.find((entry) => entry.id === 'gre_removed')?.withdrawnAt).toBeInstanceOf(Date);
    expect(state.guestRoster.find((entry) => entry.id === 'gre_changed')?.email).toBe('UPDATED@example.test');
    expect(guestQrPassService.revokeForRosterEntries).toHaveBeenCalledTimes(1);
    const [eventId, rosterIds, actor] = guestQrPassService.revokeForRosterEntries.mock.calls[0]!;
    const context = guestQrPassService.revokeForRosterEntries.mock.calls[0]?.[3] as { prisma: unknown; correlationId: string };
    expect(eventId).toBe('evt_sample');
    expect(rosterIds).toEqual(expect.arrayContaining(['gre_changed', 'gre_ineligible', 'gre_removed']));
    expect(actor).toMatchObject({ id: 'usr_pmcm', role: 'pmcm-admin' });
    expect(context.prisma).toBe(prisma);
    expect(context.correlationId).toMatch(/^roster_/);
  });

  it('maps guest event, check-in, and feedback payloads without PMCM-only fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-08T12:00:00.000Z'));
    const { service, state } = createGuestWorkflowFixture();
    const feedback = await service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', {
      guestName: 'Sofia Lim',
      rating: 5,
      comment: 'Smooth registration.',
      privacyConsentAccepted: true,
    });

    expect(service.mapGuestEvent(state.events[0] as any)).toEqual(
      expect.objectContaining({
        id: 'evt_sample',
        eventName: 'Ayala Tech Summit',
        guestAccessCode: 'AYALA-TECH-MPLE',
      }),
    );
    expect(service.mapGuestEvent(state.events[0] as any)).not.toHaveProperty('attendanceCount');
    const guestCheckInPayload = service.mapGuestCheckIn(state.guestCheckIns[0] as any);
    expect(guestCheckInPayload).toMatchObject({ guestName: 'Existing Guest' });
    expect(guestCheckInPayload).not.toHaveProperty('privacyConsentAccepted');
    expect(guestCheckInPayload).not.toHaveProperty('privacyNoticeVersion');
    expect(guestCheckInPayload).not.toHaveProperty('marketingConsentAccepted');
    expect(feedback).toEqual({
      id: feedback.id,
      eventId: feedback.eventId,
      submittedAt: '2026-06-18T10:00:00.000Z',
    });
    const [feedbackForReview] = await service.listPendingFeedbackForEvent('evt_sample');
    state.guestFeedback[0].mediaAttachments.push({
      id: 'media_1',
      kind: 'photo',
      originalFileName: 'table.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      status: 'pending_storage',
      blocker: 'Local storage adapter unavailable',
    });
    const [feedbackWithMedia] = await service.listPendingFeedbackForEvent('evt_sample');
    expect(service.mapGuestFeedback(feedbackWithMedia)).toMatchObject({
      guestName: 'Sofia Lim',
      moderationStatus: 'pending_review',
      privacyConsentAccepted: true,
      mediaAttachments: [{ id: 'media_1', kind: 'photo', blocker: 'Local storage adapter unavailable' }],
    });
    const guestEventPayload = service.mapGuestEvent(state.events[0] as any);
    const guestEventJson = JSON.stringify(guestEventPayload);
    expect(guestEventPayload).not.toHaveProperty('clientPortalStatus');
    expect(guestEventPayload).not.toHaveProperty('status');
    expect(guestEventPayload).not.toHaveProperty('archived');
    expect(guestEventPayload).not.toHaveProperty('floorPlanId');
    expect(guestEventPayload).not.toHaveProperty('floorPlanDrafts');
    expect(guestEventJson).not.toContain('budgetRange');
    expect(guestEventJson).not.toContain('serviceRequirements');
    expect(guestEventJson).not.toContain('privateNotes');
    vi.useRealTimers();
  });

  it('enforces the actual-end anchored seven-day window with distinct reasons', async () => {
    vi.useFakeTimers();
    const { service, state } = createGuestWorkflowFixture();
    vi.setSystemTime(new Date('2026-09-07T11:59:59.000Z'));
    await expect(service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'Before', rating: 5, privacyConsentAccepted: true })).rejects.toThrow('opens after the event has actually ended');
    vi.setSystemTime(new Date('2026-09-14T12:00:00.000Z'));
    await expect(service.submitFeedbackByAccessCode('AYALA-TECH-MPLE', { guestName: 'At deadline', rating: 5, privacyConsentAccepted: true })).resolves.toMatchObject({ eventId: 'evt_sample', submittedAt: expect.any(String) });
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
    await expect(service.checkInByAccessCode('AYALA-TECH-MPLE', withGuestCheckInKey({
      checkInMode: 'name_search', guestName: 'Archived Guest', privacyConsentAccepted: true,
    }))).rejects.toThrow('Guest event code was not found');
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
    expect(withdrawn).toMatchObject({ id: feedback.id, eventId: 'evt_sample', submittedAt: expect.any(String) });
    expect(state.guestFeedback[0].privacyConsentWithdrawnAt).toBeInstanceOf(Date);
    expect(state.guestFeedback[0].privacyNoticeVersion).toBe('2026-09-01');
    vi.useRealTimers();
  });
});
